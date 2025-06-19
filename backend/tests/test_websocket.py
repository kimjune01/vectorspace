import pytest
import json
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from app.models import User, Conversation, ConversationParticipant
from app.main import app
from app.services.websocket_manager import websocket_manager


class TestWebSocketManager:
    """Test cases for WebSocket manager functionality."""
    
    def test_websocket_manager_initialization(self):
        """Test WebSocket manager initializes correctly."""
        manager = websocket_manager
        assert manager.active_connections == {}
        assert manager.user_connections == {}
        assert manager.connection_lookup == {}
    
    def test_get_stats(self):
        """Test getting WebSocket manager statistics."""
        stats = websocket_manager.get_stats()
        assert "total_connections" in stats
        assert "active_conversations" in stats
        assert "connected_users" in stats
        assert "connections_per_conversation" in stats


class TestWebSocketAuthentication:
    """Test WebSocket authentication and access control."""
    
    @pytest.mark.asyncio
    async def test_websocket_requires_authentication(self, db_session, override_get_db):
        """Test that WebSocket connections require valid authentication."""
        # Create a conversation
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Test Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Test with no token
        with TestClient(app) as client:
            with pytest.raises(Exception):  # Should fail without token
                with client.websocket_connect(f"/api/ws/conversations/{conversation.id}"):
                    pass
    
    @pytest.mark.asyncio
    async def test_websocket_with_valid_token(self, db_session, override_get_db):
        """Test WebSocket connection with valid authentication token."""
        # Create user and conversation
        user = User(
            username="wsuser",
            display_name="WebSocket User", 
            email="ws@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="WebSocket Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth token first
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "wsuser",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test WebSocket connection with valid token
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Should receive connection established message
                data = websocket.receive_json()
                assert data["type"] == "connection_established"
                assert data["conversation_id"] == conversation.id
                assert data["user_id"] == user.id
    
    @pytest.mark.asyncio
    async def test_websocket_private_conversation_access(self, db_session, override_get_db):
        """Test WebSocket access control for private conversations."""
        # Create owner and outsider
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com"
        )
        owner.set_password("password")
        
        outsider = User(
            username="outsider",
            display_name="Outsider",
            email="outsider@example.com"
        )
        outsider.set_password("password")
        
        db_session.add_all([owner, outsider])
        await db_session.commit()
        
        # Create private conversation
        conversation = Conversation(
            user_id=owner.id,
            title="Private Conversation",
            is_public=False
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get token for outsider
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "outsider",
                "password": "password"
            })
            outsider_token = login_response.json()["access_token"]
        
        # Test that outsider cannot connect to private conversation
        with TestClient(app) as client:
            with pytest.raises(Exception):  # Should fail with access denied
                with client.websocket_connect(
                    f"/api/ws/conversations/{conversation.id}?token={outsider_token}"
                ):
                    pass


class TestWebSocketMessaging:
    """Test WebSocket messaging functionality."""
    
    @pytest.mark.asyncio
    async def test_send_message_via_websocket(self, db_session, override_get_db):
        """Test sending messages through WebSocket."""
        # Setup
        user = User(
            username="sender",
            display_name="Sender",
            email="sender@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Message Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "sender",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test message sending
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                connection_data = websocket.receive_json()
                assert connection_data["type"] == "connection_established"
                
                # Send a message
                message_payload = {
                    "type": "send_message",
                    "content": "Hello from WebSocket!",
                    "role": "user",
                    "message_type": "chat"
                }
                websocket.send_json(message_payload)
                
                # Should receive the broadcasted message back
                message_data = websocket.receive_json()
                assert message_data["type"] == "new_message"
                assert message_data["message"]["content"] == "Hello from WebSocket!"
                assert message_data["message"]["from_user_username"] == "sender"
                assert message_data["message"]["role"] == "user"
    
    @pytest.mark.asyncio
    async def test_message_validation(self, db_session, override_get_db):
        """Test WebSocket message validation."""
        # Setup
        user = User(
            username="validator",
            display_name="Validator",
            email="validator@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Validation Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "validator",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test message validation
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Test empty message
                websocket.send_json({
                    "type": "send_message",
                    "content": "",
                    "role": "user"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "empty" in error_data["message"].lower()
                
                # Test overly long message
                long_content = "x" * 5000  # Over 4000 character limit
                websocket.send_json({
                    "type": "send_message",
                    "content": long_content,
                    "role": "user"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "too long" in error_data["message"].lower()
    
    @pytest.mark.asyncio
    async def test_typing_indicator(self, db_session, override_get_db):
        """Test typing indicator functionality."""
        # Setup two users
        user1 = User(
            username="typer1",
            display_name="Typer 1",
            email="typer1@example.com"
        )
        user1.set_password("password")
        
        user2 = User(
            username="typer2",
            display_name="Typer 2", 
            email="typer2@example.com"
        )
        user2.set_password("password")
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user1.id,
            title="Typing Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth tokens
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login1 = await client.post("/api/auth/login", json={
                "username": "typer1",
                "password": "password"
            })
            token1 = login1.json()["access_token"]
            
            login2 = await client.post("/api/auth/login", json={
                "username": "typer2", 
                "password": "password"
            })
            token2 = login2.json()["access_token"]
        
        # Test typing indicators between two connections
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token1}"
            ) as ws1, client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token2}"
            ) as ws2:
                # Clear connection messages
                ws1.receive_json()  # connection_established
                ws2.receive_json()  # connection_established
                ws1.receive_json()  # user_joined (user2)
                ws2.receive_json()  # user_joined (user1)
                
                # User1 starts typing
                ws1.send_json({
                    "type": "typing_indicator",
                    "is_typing": True
                })
                
                # User2 should receive typing indicator
                typing_data = ws2.receive_json()
                assert typing_data["type"] == "typing_indicator"
                assert typing_data["username"] == "typer1"
                assert typing_data["is_typing"] is True