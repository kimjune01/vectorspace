import json
import time
import asyncio
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
import redis.asyncio as redis
from app.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


@dataclass
class RedisPresenceInfo:
    user_id: int
    username: str
    joined_at: float
    last_seen: float


class RedisPresenceManager:
    """Redis-backed presence manager for horizontal scaling."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.redis: Optional[redis.Redis] = None
        self.pubsub = None
        self.is_connected = False
        self.fallback_to_memory = False
        self._local_presence: Dict[int, Dict[int, RedisPresenceInfo]] = {}
        self._subscription_task = None
    
    async def connect(self):
        """Connect to Redis and setup pub/sub."""
        try:
            self.redis = redis.from_url(self.redis_url)
            await self.redis.ping()
            self.pubsub = self.redis.pubsub()
            self.is_connected = True
            self.fallback_to_memory = False
            logger.info("Connected to Redis for presence management")
            
            # Subscribe to presence updates
            await self.pubsub.subscribe("presence:updates:*")
            self._subscription_task = asyncio.create_task(self._listen_for_updates())
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.fallback_to_memory = True
            self.is_connected = False
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self._subscription_task:
            self._subscription_task.cancel()
            try:
                await self._subscription_task
            except asyncio.CancelledError:
                pass
        
        if self.pubsub:
            await self.pubsub.close()
        
        if self.redis:
            await self.redis.close()
        
        self.is_connected = False
        logger.info("Disconnected from Redis")
    
    async def _listen_for_updates(self):
        """Listen for presence updates from other instances."""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    await self._handle_presence_update(message)
        except Exception as e:
            logger.error(f"Error listening for presence updates: {e}")
    
    async def _handle_presence_update(self, message):
        """Handle presence update from Redis pub/sub."""
        try:
            channel = message["channel"].decode("utf-8")
            conversation_id = int(channel.split(":")[-1])
            data = json.loads(message["data"].decode("utf-8"))
            
            # Only broadcast to local connections (don't re-publish to Redis)
            await websocket_manager.broadcast_to_conversation(conversation_id, {
                "type": "presence_update",
                "user_id": data["user_id"],
                "username": data["username"],
                "action": data["action"],
                "conversation_id": conversation_id,
                "timestamp": data.get("timestamp", time.time())
            })
            
        except Exception as e:
            logger.error(f"Error handling presence update: {e}")
    
    async def user_joined_conversation(self, conversation_id: int, user_id: int, username: str) -> None:
        """Record that a user has joined a conversation."""
        current_time = time.time()
        presence_info = RedisPresenceInfo(
            user_id=user_id,
            username=username,
            joined_at=current_time,
            last_seen=current_time
        )
        
        if self.is_connected and not self.fallback_to_memory:
            try:
                # Store in Redis with TTL
                await self.redis.hset(
                    f"presence:{conversation_id}",
                    user_id,
                    json.dumps(asdict(presence_info))
                )
                await self.redis.expire(f"presence:{conversation_id}", 3600)  # 1 hour TTL
                
                # Publish to other instances
                await self.redis.publish(
                    f"presence:updates:{conversation_id}",
                    json.dumps({
                        "action": "joined",
                        "user_id": user_id,
                        "username": username,
                        "timestamp": current_time
                    })
                )
                
            except Exception as e:
                logger.error(f"Redis operation failed, falling back to memory: {e}")
                self.fallback_to_memory = True
        
        # Always maintain local copy for fallback
        if conversation_id not in self._local_presence:
            self._local_presence[conversation_id] = {}
        self._local_presence[conversation_id][user_id] = presence_info
        
        # Broadcast locally if Redis failed or in fallback mode
        if self.fallback_to_memory:
            await websocket_manager.broadcast_to_conversation(conversation_id, {
                "type": "presence_update",
                "user_id": user_id,
                "username": username,
                "action": "joined",
                "conversation_id": conversation_id,
                "timestamp": current_time
            })
    
    async def user_left_conversation(self, conversation_id: int, user_id: int) -> None:
        """Record that a user has left a conversation."""
        username = None
        
        # Get username from local or Redis storage
        if conversation_id in self._local_presence and user_id in self._local_presence[conversation_id]:
            username = self._local_presence[conversation_id][user_id].username
            del self._local_presence[conversation_id][user_id]
            
            if not self._local_presence[conversation_id]:
                del self._local_presence[conversation_id]
        
        if self.is_connected and not self.fallback_to_memory:
            try:
                # Get username from Redis if not found locally
                if not username:
                    presence_data = await self.redis.hget(f"presence:{conversation_id}", user_id)
                    if presence_data:
                        presence_info = json.loads(presence_data.decode("utf-8"))
                        username = presence_info["username"]
                
                # Remove from Redis
                await self.redis.hdel(f"presence:{conversation_id}", user_id)
                
                # Publish to other instances
                if username:
                    await self.redis.publish(
                        f"presence:updates:{conversation_id}",
                        json.dumps({
                            "action": "left",
                            "user_id": user_id,
                            "username": username,
                            "timestamp": time.time()
                        })
                    )
                
            except Exception as e:
                logger.error(f"Redis operation failed: {e}")
                self.fallback_to_memory = True
        
        # Broadcast locally if Redis failed or in fallback mode
        if self.fallback_to_memory and username:
            await websocket_manager.broadcast_to_conversation(conversation_id, {
                "type": "presence_update",
                "user_id": user_id,
                "username": username,
                "action": "left",
                "conversation_id": conversation_id,
                "timestamp": time.time()
            })
    
    async def update_user_activity(self, conversation_id: int, user_id: int) -> None:
        """Update user's last seen timestamp."""
        current_time = time.time()
        
        # Update local cache
        if conversation_id in self._local_presence and user_id in self._local_presence[conversation_id]:
            self._local_presence[conversation_id][user_id].last_seen = current_time
        
        if self.is_connected and not self.fallback_to_memory:
            try:
                # Update in Redis
                presence_data = await self.redis.hget(f"presence:{conversation_id}", user_id)
                if presence_data:
                    presence_info = json.loads(presence_data.decode("utf-8"))
                    presence_info["last_seen"] = current_time
                    await self.redis.hset(
                        f"presence:{conversation_id}",
                        user_id,
                        json.dumps(presence_info)
                    )
            except Exception as e:
                logger.error(f"Failed to update user activity in Redis: {e}")
    
    def get_conversation_participants(self, conversation_id: int) -> List[Dict]:
        """Get list of active participants in a conversation."""
        participants = []
        
        # Use local cache (fastest)
        if conversation_id in self._local_presence:
            for user_id, presence_info in self._local_presence[conversation_id].items():
                participants.append({
                    "user_id": user_id,
                    "username": presence_info.username,
                    "joined_at": presence_info.joined_at,
                    "last_seen": presence_info.last_seen
                })
        
        return participants
    
    async def get_conversation_participants_from_redis(self, conversation_id: int) -> List[Dict]:
        """Get participants from Redis (for cross-instance queries)."""
        if not self.is_connected or self.fallback_to_memory:
            return self.get_conversation_participants(conversation_id)
        
        try:
            presence_data = await self.redis.hgetall(f"presence:{conversation_id}")
            participants = []
            
            for user_id, data in presence_data.items():
                presence_info = json.loads(data.decode("utf-8"))
                participants.append({
                    "user_id": int(user_id.decode("utf-8")),
                    "username": presence_info["username"],
                    "joined_at": presence_info["joined_at"],
                    "last_seen": presence_info["last_seen"]
                })
            
            return participants
            
        except Exception as e:
            logger.error(f"Failed to get participants from Redis: {e}")
            return self.get_conversation_participants(conversation_id)
    
    def is_user_in_conversation(self, conversation_id: int, user_id: int) -> bool:
        """Check if a user is currently in a conversation."""
        if conversation_id not in self._local_presence:
            return False
        return user_id in self._local_presence[conversation_id]
    
    async def cleanup_inactive_users(self, timeout_seconds: int = 300) -> None:
        """Remove users who haven't been seen for the specified timeout."""
        current_time = time.time()
        conversations_to_cleanup = []
        
        for conversation_id, participants in list(self._local_presence.items()):
            users_to_remove = []
            
            for user_id, presence_info in participants.items():
                if current_time - presence_info.last_seen > timeout_seconds:
                    users_to_remove.append(user_id)
            
            # Remove inactive users
            for user_id in users_to_remove:
                await self.user_left_conversation(conversation_id, user_id)
            
            # Mark empty conversations for cleanup
            if not participants:
                conversations_to_cleanup.append(conversation_id)
        
        # Clean up empty conversations
        for conversation_id in conversations_to_cleanup:
            if conversation_id in self._local_presence:
                del self._local_presence[conversation_id]
    
    def get_stats(self) -> Dict:
        """Get Redis presence manager statistics."""
        total_conversations = len(self._local_presence)
        total_users = sum(len(participants) for participants in self._local_presence.values())
        
        return {
            "redis_connected": self.is_connected,
            "fallback_mode": self.fallback_to_memory,
            "total_conversations": total_conversations,
            "total_users": total_users,
            "conversations": {
                conv_id: len(participants)
                for conv_id, participants in self._local_presence.items()
            }
        }


# Global Redis presence manager instance
redis_presence_manager = None


async def get_redis_presence_manager(redis_url: str = "redis://localhost:6379/0"):
    """Get or create the global Redis presence manager instance."""
    global redis_presence_manager
    if redis_presence_manager is None:
        redis_presence_manager = RedisPresenceManager(redis_url)
        await redis_presence_manager.connect()
    return redis_presence_manager


async def start_redis_presence_cleanup_task(redis_url: str = "redis://localhost:6379/0"):
    """Start background task to clean up inactive users in Redis."""
    manager = await get_redis_presence_manager(redis_url)
    
    while True:
        try:
            await manager.cleanup_inactive_users(timeout_seconds=300)  # 5 minutes
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error in Redis presence cleanup task: {e}")
            await asyncio.sleep(60)