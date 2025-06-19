from typing import Dict, Set, List, Optional
import asyncio
import time
from dataclasses import dataclass
from app.services.websocket_manager import websocket_manager


@dataclass
class PresenceInfo:
    user_id: int
    username: str
    joined_at: float
    last_seen: float


class PresenceManager:
    """Manages user presence information for conversations."""
    
    def __init__(self):
        # conversation_id -> {user_id -> PresenceInfo}
        self._presence_data: Dict[int, Dict[int, PresenceInfo]] = {}
    
    async def user_joined_conversation(self, conversation_id: int, user_id: int, username: str) -> None:
        """Record that a user has joined a conversation."""
        current_time = time.time()
        
        if conversation_id not in self._presence_data:
            self._presence_data[conversation_id] = {}
        
        # Add or update user presence
        self._presence_data[conversation_id][user_id] = PresenceInfo(
            user_id=user_id,
            username=username,
            joined_at=current_time,
            last_seen=current_time
        )
        
        # Broadcast presence update to conversation participants
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
        if conversation_id not in self._presence_data:
            return
        
        presence_info = self._presence_data[conversation_id].get(user_id)
        if not presence_info:
            return
        
        # Remove user from presence data
        del self._presence_data[conversation_id][user_id]
        
        # Clean up empty conversation data
        if not self._presence_data[conversation_id]:
            del self._presence_data[conversation_id]
        
        # Broadcast presence update to conversation participants
        await websocket_manager.broadcast_to_conversation(conversation_id, {
            "type": "presence_update",
            "user_id": user_id,
            "username": presence_info.username,
            "action": "left",
            "conversation_id": conversation_id,
            "timestamp": time.time()
        })
    
    async def update_user_activity(self, conversation_id: int, user_id: int) -> None:
        """Update user's last seen timestamp."""
        if conversation_id not in self._presence_data:
            return
        
        if user_id not in self._presence_data[conversation_id]:
            return
        
        self._presence_data[conversation_id][user_id].last_seen = time.time()
    
    def get_conversation_participants(self, conversation_id: int) -> List[Dict]:
        """Get list of active participants in a conversation."""
        if conversation_id not in self._presence_data:
            return []
        
        participants = []
        for user_id, presence_info in self._presence_data[conversation_id].items():
            participants.append({
                "user_id": user_id,
                "username": presence_info.username,
                "joined_at": presence_info.joined_at,
                "last_seen": presence_info.last_seen
            })
        
        return participants
    
    def is_user_in_conversation(self, conversation_id: int, user_id: int) -> bool:
        """Check if a user is currently in a conversation."""
        if conversation_id not in self._presence_data:
            return False
        
        return user_id in self._presence_data[conversation_id]
    
    def get_user_conversations(self, user_id: int) -> List[int]:
        """Get list of conversations a user is currently in."""
        conversations = []
        for conversation_id, participants in self._presence_data.items():
            if user_id in participants:
                conversations.append(conversation_id)
        
        return conversations
    
    async def cleanup_inactive_users(self, timeout_seconds: int = 300) -> None:
        """Remove users who haven't been seen for the specified timeout."""
        current_time = time.time()
        conversations_to_cleanup = []
        
        for conversation_id, participants in self._presence_data.items():
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
            if conversation_id in self._presence_data:
                del self._presence_data[conversation_id]
    
    def get_stats(self) -> Dict:
        """Get presence manager statistics."""
        total_conversations = len(self._presence_data)
        total_users = sum(len(participants) for participants in self._presence_data.values())
        
        return {
            "total_conversations": total_conversations,
            "total_users": total_users,
            "conversations": {
                conv_id: len(participants)
                for conv_id, participants in self._presence_data.items()
            }
        }


# Global presence manager instance
presence_manager = PresenceManager()


async def start_presence_cleanup_task():
    """Start background task to clean up inactive users."""
    while True:
        try:
            await presence_manager.cleanup_inactive_users(timeout_seconds=300)  # 5 minutes
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            # Log error but don't stop the cleanup task
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in presence cleanup task: {e}")
            await asyncio.sleep(60)