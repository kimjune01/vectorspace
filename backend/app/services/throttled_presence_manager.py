import asyncio
import time
import logging
from typing import Dict, Set, Optional, Any
from collections import defaultdict, deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ThrottleConfig:
    """Configuration for different types of presence events."""
    presence_updates: float = 0.05  # 50ms between presence join/leave broadcasts
    activity_updates: float = 1.0   # 1 second between activity updates
    typing_updates: float = 0.1     # 100ms between typing indicators
    cursor_updates: float = 0.05    # 50ms between cursor position updates


class RateLimiter:
    """Token bucket rate limiter for presence events."""
    
    def __init__(self, max_requests: int, time_window: float):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, key: str) -> bool:
        """Check if a request is allowed for the given key."""
        now = time.time()
        window_start = now - self.time_window
        
        # Remove old requests outside the time window
        while self.requests[key] and self.requests[key][0] < window_start:
            self.requests[key].popleft()
        
        # Check if we're under the limit
        if len(self.requests[key]) < self.max_requests:
            self.requests[key].append(now)
            return True
        
        return False
    
    def get_retry_after(self, key: str) -> float:
        """Get seconds until next request is allowed."""
        if not self.requests[key]:
            return 0.0
        
        oldest_request = self.requests[key][0]
        return max(0.0, self.time_window - (time.time() - oldest_request))


class ThrottledPresenceManager:
    """Presence manager with throttling and rate limiting."""
    
    def __init__(self, presence_manager, websocket_manager):
        self.presence_manager = presence_manager
        self.websocket_manager = websocket_manager
        self.config = ThrottleConfig()
        
        # Throttling state
        self.last_broadcast: Dict[str, float] = {}
        self.pending_broadcasts: Dict[str, Dict] = {}
        self.broadcast_timers: Dict[str, asyncio.Task] = {}
        
        # Rate limiters
        self.user_rate_limiter = RateLimiter(max_requests=10, time_window=60.0)  # 10 requests per minute per user
        self.conversation_rate_limiter = RateLimiter(max_requests=100, time_window=60.0)  # 100 requests per minute per conversation
        
        # Metrics
        self.metrics = {
            "throttled_events": 0,
            "rate_limited_events": 0,
            "total_events": 0,
            "average_latency": 0.0
        }
    
    async def user_joined_conversation(self, conversation_id: int, user_id: int, username: str) -> None:
        """Throttled version of user joined conversation."""
        event_key = f"join:{conversation_id}:{user_id}"
        
        # Check rate limits
        if not self._check_rate_limits(conversation_id, user_id):
            return
        
        # Call original method
        await self.presence_manager.user_joined_conversation(conversation_id, user_id, username)
        
        # Throttle broadcast
        await self._throttled_broadcast(
            event_key,
            conversation_id,
            {
                "type": "presence_update",
                "user_id": user_id,
                "username": username,
                "action": "joined",
                "conversation_id": conversation_id,
                "timestamp": time.time()
            },
            self.config.presence_updates
        )
        
        self.metrics["total_events"] += 1
    
    async def user_left_conversation(self, conversation_id: int, user_id: int) -> None:
        """Throttled version of user left conversation."""
        event_key = f"leave:{conversation_id}:{user_id}"
        
        # Get username before removal
        username = None
        if hasattr(self.presence_manager, '_presence_data'):
            presence_data = self.presence_manager._presence_data.get(conversation_id, {})
            if user_id in presence_data:
                username = presence_data[user_id].username
        
        # Check rate limits
        if not self._check_rate_limits(conversation_id, user_id):
            return
        
        # Call original method
        await self.presence_manager.user_left_conversation(conversation_id, user_id)
        
        # Throttle broadcast
        if username:
            await self._throttled_broadcast(
                event_key,
                conversation_id,
                {
                    "type": "presence_update",
                    "user_id": user_id,
                    "username": username,
                    "action": "left",
                    "conversation_id": conversation_id,
                    "timestamp": time.time()
                },
                self.config.presence_updates
            )
        
        self.metrics["total_events"] += 1
    
    async def update_user_activity(self, conversation_id: int, user_id: int) -> None:
        """Throttled version of update user activity."""
        event_key = f"activity:{conversation_id}:{user_id}"
        
        # Always update the underlying presence manager
        await self.presence_manager.update_user_activity(conversation_id, user_id)
        
        # Throttle activity broadcasts (optional, can be disabled)
        # Only broadcast activity updates if explicitly needed
        # Most implementations don't broadcast activity updates
        
        self.metrics["total_events"] += 1
    
    async def broadcast_typing_indicator(self, conversation_id: int, user_id: int, username: str, is_typing: bool) -> None:
        """Throttled typing indicator broadcast."""
        event_key = f"typing:{conversation_id}:{user_id}"
        
        # Check rate limits
        if not self._check_rate_limits(conversation_id, user_id):
            return
        
        await self._throttled_broadcast(
            event_key,
            conversation_id,
            {
                "type": "typing_indicator",
                "user_id": user_id,
                "username": username,
                "is_typing": is_typing,
                "conversation_id": conversation_id,
                "timestamp": time.time()
            },
            self.config.typing_updates
        )
        
        self.metrics["total_events"] += 1
    
    async def broadcast_cursor_position(self, conversation_id: int, user_id: int, username: str, position: Dict) -> None:
        """Throttled cursor position broadcast."""
        event_key = f"cursor:{conversation_id}:{user_id}"
        
        # Check rate limits
        if not self._check_rate_limits(conversation_id, user_id):
            return
        
        await self._throttled_broadcast(
            event_key,
            conversation_id,
            {
                "type": "cursor_position",
                "user_id": user_id,
                "username": username,
                "position": position,
                "conversation_id": conversation_id,
                "timestamp": time.time()
            },
            self.config.cursor_updates
        )
        
        self.metrics["total_events"] += 1
    
    def _check_rate_limits(self, conversation_id: int, user_id: int) -> bool:
        """Check if the event is within rate limits."""
        user_key = f"user:{user_id}"
        conversation_key = f"conversation:{conversation_id}"
        
        user_allowed = self.user_rate_limiter.is_allowed(user_key)
        conversation_allowed = self.conversation_rate_limiter.is_allowed(conversation_key)
        
        if not user_allowed or not conversation_allowed:
            self.metrics["rate_limited_events"] += 1
            logger.debug(f"Rate limited: user={user_allowed}, conversation={conversation_allowed}")
            return False
        
        return True
    
    async def _throttled_broadcast(self, event_key: str, conversation_id: int, message: Dict, throttle_interval: float) -> None:
        """Broadcast message with throttling."""
        now = time.time()
        
        # Check if we should throttle
        if event_key in self.last_broadcast and now - self.last_broadcast[event_key] < throttle_interval:
            # Store the latest message and schedule a delayed broadcast
            self.pending_broadcasts[event_key] = {
                "conversation_id": conversation_id,
                "message": message,
                "scheduled_time": self.last_broadcast[event_key] + throttle_interval
            }
            
            # Cancel existing timer if any
            if event_key in self.broadcast_timers:
                self.broadcast_timers[event_key].cancel()
            
            # Schedule new broadcast
            delay = self.last_broadcast[event_key] + throttle_interval - now
            self.broadcast_timers[event_key] = asyncio.create_task(
                self._delayed_broadcast(event_key, delay)
            )
            
            self.metrics["throttled_events"] += 1
            return
        
        # Broadcast immediately
        await self._do_broadcast(conversation_id, message)
        self.last_broadcast[event_key] = now
    
    async def _delayed_broadcast(self, event_key: str, delay: float) -> None:
        """Execute a delayed broadcast."""
        try:
            await asyncio.sleep(delay)
            
            if event_key in self.pending_broadcasts:
                pending = self.pending_broadcasts.pop(event_key)
                await self._do_broadcast(pending["conversation_id"], pending["message"])
                self.last_broadcast[event_key] = time.time()
            
            # Clean up timer reference
            if event_key in self.broadcast_timers:
                del self.broadcast_timers[event_key]
                
        except asyncio.CancelledError:
            # Timer was cancelled, clean up
            if event_key in self.broadcast_timers:
                del self.broadcast_timers[event_key]
            raise
    
    async def _do_broadcast(self, conversation_id: int, message: Dict) -> None:
        """Actually broadcast the message."""
        start_time = time.time()
        
        sent_count = await self.websocket_manager.broadcast_to_conversation(conversation_id, message)
        
        # Update latency metric
        latency = time.time() - start_time
        self.metrics["average_latency"] = (self.metrics["average_latency"] * 0.9) + (latency * 0.1)
        
        logger.debug(f"Broadcasted to {sent_count} connections in {latency:.3f}s")
    
    # Delegate other methods to the underlying presence manager
    def get_conversation_participants(self, conversation_id: int):
        return self.presence_manager.get_conversation_participants(conversation_id)
    
    def is_user_in_conversation(self, conversation_id: int, user_id: int) -> bool:
        return self.presence_manager.is_user_in_conversation(conversation_id, user_id)
    
    def get_user_conversations(self, user_id: int):
        if hasattr(self.presence_manager, 'get_user_conversations'):
            return self.presence_manager.get_user_conversations(user_id)
        return []
    
    async def cleanup_inactive_users(self, timeout_seconds: int = 300) -> None:
        await self.presence_manager.cleanup_inactive_users(timeout_seconds)
    
    def get_stats(self) -> Dict:
        """Get throttled presence manager statistics."""
        base_stats = self.presence_manager.get_stats() if hasattr(self.presence_manager, 'get_stats') else {}
        
        return {
            **base_stats,
            "throttling": {
                "pending_broadcasts": len(self.pending_broadcasts),
                "active_timers": len(self.broadcast_timers),
                "throttle_config": {
                    "presence_updates": self.config.presence_updates,
                    "activity_updates": self.config.activity_updates,
                    "typing_updates": self.config.typing_updates,
                    "cursor_updates": self.config.cursor_updates
                }
            },
            "rate_limiting": {
                "user_limit": f"{self.user_rate_limiter.max_requests}/min",
                "conversation_limit": f"{self.conversation_rate_limiter.max_requests}/min"
            },
            "metrics": self.metrics
        }