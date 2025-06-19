import json
import uuid
from typing import Dict, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionInfo:
    """Information about a WebSocket connection."""
    
    def __init__(self, websocket: WebSocket, user_id: int, username: str, conversation_id: int):
        self.websocket = websocket
        self.user_id = user_id
        self.username = username
        self.conversation_id = conversation_id
        self.connection_id = str(uuid.uuid4())
        self.connected_at = datetime.utcnow()
        self.last_seen = datetime.utcnow()
    
    def update_last_seen(self):
        """Update the last seen timestamp."""
        self.last_seen = datetime.utcnow()


class ConversationWebSocketManager:
    """Manages WebSocket connections for real-time conversation features."""
    
    def __init__(self):
        # conversation_id -> List[ConnectionInfo]
        self.active_connections: Dict[int, List[ConnectionInfo]] = {}
        
        # user_id -> Set[connection_id] (for tracking user's connections)
        self.user_connections: Dict[int, Set[str]] = {}
        
        # connection_id -> ConnectionInfo (for quick lookup)
        self.connection_lookup: Dict[str, ConnectionInfo] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: int, user_id: int, username: str) -> str:
        """Connect a user to a conversation via WebSocket."""
        await websocket.accept()
        
        # Create connection info
        connection = ConnectionInfo(websocket, user_id, username, conversation_id)
        
        # Add to conversation connections
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        self.active_connections[conversation_id].append(connection)
        
        # Add to user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection.connection_id)
        
        # Add to lookup
        self.connection_lookup[connection.connection_id] = connection
        
        logger.info(f"User {username} ({user_id}) connected to conversation {conversation_id}")
        
        # Notify other participants about the new connection
        await self.broadcast_to_conversation(
            conversation_id,
            {
                "type": "user_joined",
                "user_id": user_id,
                "username": username,
                "timestamp": datetime.utcnow().isoformat()
            },
            exclude_connection_id=connection.connection_id
        )
        
        return connection.connection_id
    
    async def disconnect(self, connection_id: str):
        """Disconnect a user from a conversation."""
        if connection_id not in self.connection_lookup:
            return
        
        connection = self.connection_lookup[connection_id]
        conversation_id = connection.conversation_id
        user_id = connection.user_id
        username = connection.username
        
        # Remove from conversation connections
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id] = [
                conn for conn in self.active_connections[conversation_id]
                if conn.connection_id != connection_id
            ]
            
            # Clean up empty conversation lists
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
        
        # Remove from user connections
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remove from lookup
        del self.connection_lookup[connection_id]
        
        logger.info(f"User {username} ({user_id}) disconnected from conversation {conversation_id}")
        
        # Notify other participants about the disconnection
        await self.broadcast_to_conversation(
            conversation_id,
            {
                "type": "user_left",
                "user_id": user_id,
                "username": username,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    async def send_to_connection(self, connection_id: str, message: dict):
        """Send a message to a specific connection."""
        if connection_id not in self.connection_lookup:
            return False
        
        connection = self.connection_lookup[connection_id]
        try:
            await connection.websocket.send_text(json.dumps(message))
            connection.update_last_seen()
            return True
        except Exception as e:
            logger.error(f"Error sending message to connection {connection_id}: {e}")
            await self.disconnect(connection_id)
            return False
    
    async def send_to_user(self, user_id: int, message: dict) -> int:
        """Send a message to all connections of a specific user. Returns count of successful sends."""
        if user_id not in self.user_connections:
            return 0
        
        sent_count = 0
        connection_ids = list(self.user_connections[user_id])  # Copy to avoid modification during iteration
        
        for connection_id in connection_ids:
            if await self.send_to_connection(connection_id, message):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_conversation(
        self, 
        conversation_id: int, 
        message: dict, 
        exclude_connection_id: Optional[str] = None
    ) -> int:
        """Broadcast a message to all participants in a conversation. Returns count of successful sends."""
        if conversation_id not in self.active_connections:
            return 0
        
        sent_count = 0
        connections = list(self.active_connections[conversation_id])  # Copy to avoid modification during iteration
        
        for connection in connections:
            if exclude_connection_id and connection.connection_id == exclude_connection_id:
                continue
            
            if await self.send_to_connection(connection.connection_id, message):
                sent_count += 1
        
        return sent_count
    
    def get_conversation_participants(self, conversation_id: int) -> List[Dict]:
        """Get list of currently connected participants in a conversation."""
        if conversation_id not in self.active_connections:
            return []
        
        participants = []
        for connection in self.active_connections[conversation_id]:
            participants.append({
                "user_id": connection.user_id,
                "username": connection.username,
                "connected_at": connection.connected_at.isoformat(),
                "last_seen": connection.last_seen.isoformat()
            })
        
        return participants
    
    def get_connection_count(self, conversation_id: int) -> int:
        """Get the number of active connections for a conversation."""
        return len(self.active_connections.get(conversation_id, []))
    
    def is_user_connected(self, user_id: int, conversation_id: Optional[int] = None) -> bool:
        """Check if a user is connected, optionally to a specific conversation."""
        if user_id not in self.user_connections:
            return False
        
        if conversation_id is None:
            return len(self.user_connections[user_id]) > 0
        
        # Check if user has connections to the specific conversation
        for connection_id in self.user_connections[user_id]:
            connection = self.connection_lookup.get(connection_id)
            if connection and connection.conversation_id == conversation_id:
                return True
        
        return False
    
    async def cleanup_stale_connections(self, max_idle_minutes: int = 30):
        """Remove connections that have been idle for too long."""
        cutoff_time = datetime.utcnow() - asyncio.timedelta(minutes=max_idle_minutes)
        stale_connections = []
        
        for connection_id, connection in self.connection_lookup.items():
            if connection.last_seen < cutoff_time:
                stale_connections.append(connection_id)
        
        for connection_id in stale_connections:
            await self.disconnect(connection_id)
        
        logger.info(f"Cleaned up {len(stale_connections)} stale connections")
        return len(stale_connections)
    
    def get_stats(self) -> Dict:
        """Get WebSocket manager statistics."""
        total_connections = len(self.connection_lookup)
        active_conversations = len(self.active_connections)
        connected_users = len(self.user_connections)
        
        return {
            "total_connections": total_connections,
            "active_conversations": active_conversations,
            "connected_users": connected_users,
            "connections_per_conversation": {
                conv_id: len(connections) 
                for conv_id, connections in self.active_connections.items()
            }
        }


# Global instance
websocket_manager = ConversationWebSocketManager()