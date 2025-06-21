import asyncio
import logging
import time
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class HeartbeatManager:
    """Manages WebSocket heartbeats to detect and cleanup stale connections."""
    
    def __init__(self, websocket_manager):
        self.websocket_manager = websocket_manager
        self.heartbeat_interval = 30  # seconds
        self.pong_timeout = 10  # seconds to wait for pong response
        self.pending_pongs: Dict[str, float] = {}  # connection_id -> ping_time
        self.is_running = False
        self._heartbeat_task = None
    
    async def start_heartbeat_task(self):
        """Start the heartbeat background task."""
        if self.is_running:
            return
        
        self.is_running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info("Heartbeat manager started")
    
    async def stop_heartbeat_task(self):
        """Stop the heartbeat background task."""
        self.is_running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        logger.info("Heartbeat manager stopped")
    
    async def _heartbeat_loop(self):
        """Main heartbeat loop that sends pings and checks for stale connections."""
        while self.is_running:
            try:
                await self._send_pings()
                await self._cleanup_stale_pongs()
                await asyncio.sleep(self.heartbeat_interval)
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                await asyncio.sleep(5)  # Brief pause before retry
    
    async def _send_pings(self):
        """Send ping to all active connections."""
        current_time = time.time()
        connections_to_ping = list(self.websocket_manager.connection_lookup.items())
        
        for connection_id, connection in connections_to_ping:
            try:
                # FastAPI WebSocket doesn't have ping() method
                # Instead, send a simple JSON ping message
                await connection.websocket.send_json({
                    "type": "ping",
                    "timestamp": current_time
                })
                self.pending_pongs[connection_id] = current_time
                logger.debug(f"Sent ping to connection {connection_id}")
            except Exception as e:
                logger.warning(f"Failed to ping connection {connection_id}: {e}")
                # Remove from pending pongs and disconnect
                self.pending_pongs.pop(connection_id, None)
                await self.websocket_manager.disconnect(connection_id)
    
    async def _cleanup_stale_pongs(self):
        """Remove connections that haven't responded to ping within timeout."""
        current_time = time.time()
        stale_connections = []
        
        for connection_id, ping_time in list(self.pending_pongs.items()):
            if current_time - ping_time > self.pong_timeout:
                stale_connections.append(connection_id)
        
        for connection_id in stale_connections:
            logger.warning(f"Connection {connection_id} failed to respond to ping, disconnecting")
            self.pending_pongs.pop(connection_id, None)
            await self.websocket_manager.disconnect(connection_id)
        
        if stale_connections:
            logger.info(f"Cleaned up {len(stale_connections)} stale connections")
    
    def handle_pong(self, connection_id: str):
        """Handle pong response from a connection."""
        if connection_id in self.pending_pongs:
            ping_time = self.pending_pongs.pop(connection_id)
            latency = time.time() - ping_time
            logger.debug(f"Received pong from connection {connection_id}, latency: {latency:.3f}s")
            
            # Update connection last seen
            if connection_id in self.websocket_manager.connection_lookup:
                self.websocket_manager.connection_lookup[connection_id].update_last_seen()
    
    def get_stats(self) -> Dict:
        """Get heartbeat manager statistics."""
        return {
            "is_running": self.is_running,
            "heartbeat_interval": self.heartbeat_interval,
            "pong_timeout": self.pong_timeout,
            "pending_pongs": len(self.pending_pongs),
            "pending_pong_connections": list(self.pending_pongs.keys())
        }


# Global instance
heartbeat_manager = None


def get_heartbeat_manager(websocket_manager):
    """Get or create the global heartbeat manager instance."""
    global heartbeat_manager
    if heartbeat_manager is None:
        heartbeat_manager = HeartbeatManager(websocket_manager)
    return heartbeat_manager