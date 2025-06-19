import time
import asyncio
import logging
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


@dataclass
class SessionMetrics:
    """Metrics for a user session."""
    user_id: int
    username: str
    conversation_id: int
    session_start: float
    session_end: Optional[float] = None
    total_messages: int = 0
    total_events: int = 0
    last_activity: float = field(default_factory=time.time)
    
    @property
    def duration(self) -> float:
        """Get session duration in seconds."""
        end_time = self.session_end or time.time()
        return end_time - self.session_start
    
    @property
    def is_active(self) -> bool:
        """Check if session is still active."""
        return self.session_end is None


@dataclass
class ConversationMetrics:
    """Metrics for a conversation."""
    conversation_id: int
    created_at: float
    total_participants: int = 0
    peak_concurrent_users: int = 0
    total_messages: int = 0
    total_presence_events: int = 0
    average_session_duration: float = 0.0
    current_participants: int = 0


class PresenceMetricsCollector:
    """Collects and tracks metrics for WebSocket presence system."""
    
    def __init__(self):
        self.session_metrics: Dict[str, SessionMetrics] = {}  # session_key -> SessionMetrics
        self.conversation_metrics: Dict[int, ConversationMetrics] = {}  # conversation_id -> ConversationMetrics
        self.global_metrics = {
            "total_sessions": 0,
            "concurrent_users": 0,
            "peak_concurrent_users": 0,
            "total_conversations": 0,
            "active_conversations": 0,
            "average_session_duration": 0.0,
            "messages_per_second": 0.0,
            "events_per_second": 0.0,
            "uptime": time.time()
        }
        
        # Time-series data (last 60 minutes)
        self.time_series = {
            "concurrent_users": deque(maxlen=3600),  # 1 hour of second-by-second data
            "messages_per_minute": deque(maxlen=60),  # 1 hour of minute-by-minute data
            "events_per_minute": deque(maxlen=60),
            "new_sessions_per_minute": deque(maxlen=60)
        }
        
        # Event counters for rate calculations
        self.event_counters = {
            "messages_last_minute": deque(maxlen=60),
            "events_last_minute": deque(maxlen=60),
            "sessions_last_minute": deque(maxlen=60)
        }
        
        # Start background tasks
        self._metrics_task = None
        self._cleanup_task = None
        self.is_running = False
    
    async def start_metrics_collection(self):
        """Start background metrics collection tasks."""
        if self.is_running:
            return
        
        self.is_running = True
        self._metrics_task = asyncio.create_task(self._metrics_collection_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Presence metrics collection started")
    
    async def stop_metrics_collection(self):
        """Stop background metrics collection tasks."""
        self.is_running = False
        
        if self._metrics_task:
            self._metrics_task.cancel()
            try:
                await self._metrics_task
            except asyncio.CancelledError:
                pass
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Presence metrics collection stopped")
    
    async def _metrics_collection_loop(self):
        """Main metrics collection loop."""
        while self.is_running:
            try:
                await self._update_time_series()
                await self._calculate_rates()
                await asyncio.sleep(1)  # Update every second
            except Exception as e:
                logger.error(f"Error in metrics collection loop: {e}")
                await asyncio.sleep(5)
    
    async def _cleanup_loop(self):
        """Cleanup old metrics data."""
        while self.is_running:
            try:
                await self._cleanup_old_sessions()
                await asyncio.sleep(300)  # Cleanup every 5 minutes
            except Exception as e:
                logger.error(f"Error in metrics cleanup loop: {e}")
                await asyncio.sleep(60)
    
    def track_user_joined(self, conversation_id: int, user_id: int, username: str):
        """Track user joining a conversation."""
        session_key = f"{conversation_id}:{user_id}"
        current_time = time.time()
        
        # Create session metrics
        session = SessionMetrics(
            user_id=user_id,
            username=username,
            conversation_id=conversation_id,
            session_start=current_time
        )
        self.session_metrics[session_key] = session
        
        # Update conversation metrics
        if conversation_id not in self.conversation_metrics:
            self.conversation_metrics[conversation_id] = ConversationMetrics(
                conversation_id=conversation_id,
                created_at=current_time
            )
        
        conv_metrics = self.conversation_metrics[conversation_id]
        conv_metrics.current_participants += 1
        conv_metrics.total_participants = max(conv_metrics.total_participants, conv_metrics.current_participants)
        conv_metrics.peak_concurrent_users = max(conv_metrics.peak_concurrent_users, conv_metrics.current_participants)
        
        # Update global metrics
        self.global_metrics["total_sessions"] += 1
        self.global_metrics["concurrent_users"] += 1
        self.global_metrics["peak_concurrent_users"] = max(
            self.global_metrics["peak_concurrent_users"],
            self.global_metrics["concurrent_users"]
        )
        
        # Track new session
        self.event_counters["sessions_last_minute"].append(current_time)
        
        logger.debug(f"User {username} joined conversation {conversation_id}")
    
    def track_user_left(self, conversation_id: int, user_id: int):
        """Track user leaving a conversation."""
        session_key = f"{conversation_id}:{user_id}"
        current_time = time.time()
        
        # Update session metrics
        if session_key in self.session_metrics:
            session = self.session_metrics[session_key]
            session.session_end = current_time
            
            # Update conversation metrics
            if conversation_id in self.conversation_metrics:
                conv_metrics = self.conversation_metrics[conversation_id]
                conv_metrics.current_participants = max(0, conv_metrics.current_participants - 1)
                
                # Update average session duration
                total_duration = conv_metrics.average_session_duration * (conv_metrics.total_participants - 1) + session.duration
                conv_metrics.average_session_duration = total_duration / conv_metrics.total_participants
        
        # Update global metrics
        self.global_metrics["concurrent_users"] = max(0, self.global_metrics["concurrent_users"] - 1)
        
        logger.debug(f"User {user_id} left conversation {conversation_id}")
    
    def track_message(self, conversation_id: int, user_id: int):
        """Track a message sent in a conversation."""
        session_key = f"{conversation_id}:{user_id}"
        current_time = time.time()
        
        # Update session metrics
        if session_key in self.session_metrics:
            session = self.session_metrics[session_key]
            session.total_messages += 1
            session.last_activity = current_time
        
        # Update conversation metrics
        if conversation_id in self.conversation_metrics:
            self.conversation_metrics[conversation_id].total_messages += 1
        
        # Track for rate calculation
        self.event_counters["messages_last_minute"].append(current_time)
    
    def track_presence_event(self, conversation_id: int, user_id: int, event_type: str):
        """Track a presence event (join, leave, activity, etc.)."""
        session_key = f"{conversation_id}:{user_id}"
        current_time = time.time()
        
        # Update session metrics
        if session_key in self.session_metrics:
            session = self.session_metrics[session_key]
            session.total_events += 1
            session.last_activity = current_time
        
        # Update conversation metrics
        if conversation_id in self.conversation_metrics:
            self.conversation_metrics[conversation_id].total_presence_events += 1
        
        # Track for rate calculation
        self.event_counters["events_last_minute"].append(current_time)
    
    async def _update_time_series(self):
        """Update time-series metrics."""
        current_time = time.time()
        
        # Add current concurrent users
        self.time_series["concurrent_users"].append({
            "timestamp": current_time,
            "value": self.global_metrics["concurrent_users"]
        })
    
    async def _calculate_rates(self):
        """Calculate rates (messages/events per second)."""
        current_time = time.time()
        minute_ago = current_time - 60
        
        # Count events in the last minute
        recent_messages = [t for t in self.event_counters["messages_last_minute"] if t > minute_ago]
        recent_events = [t for t in self.event_counters["events_last_minute"] if t > minute_ago]
        
        # Update rates
        self.global_metrics["messages_per_second"] = len(recent_messages) / 60.0
        self.global_metrics["events_per_second"] = len(recent_events) / 60.0
        
        # Add to minute-by-minute time series (every 60 seconds)
        if int(current_time) % 60 == 0:
            self.time_series["messages_per_minute"].append({
                "timestamp": current_time,
                "value": len(recent_messages)
            })
            self.time_series["events_per_minute"].append({
                "timestamp": current_time,
                "value": len(recent_events)
            })
    
    async def _cleanup_old_sessions(self):
        """Clean up old session data."""
        current_time = time.time()
        cutoff_time = current_time - 3600  # 1 hour ago
        
        sessions_to_remove = []
        for session_key, session in self.session_metrics.items():
            if session.session_end and session.session_end < cutoff_time:
                sessions_to_remove.append(session_key)
        
        for session_key in sessions_to_remove:
            del self.session_metrics[session_key]
        
        logger.debug(f"Cleaned up {len(sessions_to_remove)} old sessions")
    
    def get_conversation_stats(self, conversation_id: int) -> Optional[Dict]:
        """Get detailed stats for a specific conversation."""
        if conversation_id not in self.conversation_metrics:
            return None
        
        conv_metrics = self.conversation_metrics[conversation_id]
        
        # Get active sessions for this conversation
        active_sessions = [
            session for session in self.session_metrics.values()
            if session.conversation_id == conversation_id and session.is_active
        ]
        
        return {
            "conversation_id": conversation_id,
            "current_participants": len(active_sessions),
            "total_participants": conv_metrics.total_participants,
            "peak_concurrent_users": conv_metrics.peak_concurrent_users,
            "total_messages": conv_metrics.total_messages,
            "total_presence_events": conv_metrics.total_presence_events,
            "average_session_duration": conv_metrics.average_session_duration,
            "created_at": conv_metrics.created_at,
            "active_sessions": [
                {
                    "user_id": session.user_id,
                    "username": session.username,
                    "duration": session.duration,
                    "messages": session.total_messages,
                    "events": session.total_events,
                    "last_activity": session.last_activity
                }
                for session in active_sessions
            ]
        }
    
    def get_global_stats(self) -> Dict:
        """Get global presence statistics."""
        current_time = time.time()
        uptime = current_time - self.global_metrics["uptime"]
        
        # Calculate average session duration across all sessions
        completed_sessions = [s for s in self.session_metrics.values() if s.session_end]
        avg_session_duration = 0.0
        if completed_sessions:
            avg_session_duration = sum(s.duration for s in completed_sessions) / len(completed_sessions)
        
        return {
            **self.global_metrics,
            "uptime": uptime,
            "average_session_duration": avg_session_duration,
            "active_conversations": len([c for c in self.conversation_metrics.values() if c.current_participants > 0]),
            "total_conversations": len(self.conversation_metrics),
            "active_sessions": len([s for s in self.session_metrics.values() if s.is_active]),
            "completed_sessions": len([s for s in self.session_metrics.values() if not s.is_active])
        }
    
    def get_time_series(self, metric: str, duration_minutes: int = 60) -> List[Dict]:
        """Get time-series data for a specific metric."""
        if metric not in self.time_series:
            return []
        
        current_time = time.time()
        cutoff_time = current_time - (duration_minutes * 60)
        
        return [
            point for point in self.time_series[metric]
            if point["timestamp"] > cutoff_time
        ]
    
    def export_metrics(self) -> Dict:
        """Export all metrics for external monitoring systems."""
        return {
            "global": self.get_global_stats(),
            "conversations": {
                conv_id: self.get_conversation_stats(conv_id)
                for conv_id in self.conversation_metrics.keys()
            },
            "time_series": {
                metric: list(data)[-60:]  # Last 60 data points
                for metric, data in self.time_series.items()
            },
            "timestamp": time.time()
        }


# Global metrics collector instance
presence_metrics = PresenceMetricsCollector()