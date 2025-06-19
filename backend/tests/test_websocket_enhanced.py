import pytest
import json
import time
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from app.models import User, Conversation, ConversationParticipant, Message
from app.main import app
from app.routers.websocket import validate_message_content, is_rate_limited
from sqlalchemy import select


class TestWebSocketValidation:
    """Test enhanced WebSocket message validation."""
    
    def test_validate_message_content_empty(self):
        """Test validation of empty message content."""
        error = validate_message_content("", "user", "chat")
        assert error == "Message content cannot be empty"
    
    def test_validate_message_content_whitespace_only(self):
        """Test validation of whitespace-only content."""
        error = validate_message_content("   \n\t  ", "user", "chat")
        assert error == "Message content cannot be only whitespace"
    
    def test_validate_message_content_too_long(self):
        """Test validation of overly long content."""
        long_content = "x" * 4001
        error = validate_message_content(long_content, "user", "chat")
        assert error == "Message content too long (max 4000 characters)"
    
    def test_validate_message_content_invalid_role(self):
        """Test validation of invalid role."""
        error = validate_message_content("Hello", "invalid_role", "chat")
        assert "Invalid role" in error
    
    def test_validate_message_content_invalid_message_type(self):
        """Test validation of invalid message type."""
        error = validate_message_content("Hello", "user", "invalid_type")
        assert "Invalid message type" in error
    
    def test_validate_message_content_harmful_script(self):
        """Test validation catches harmful script content."""
        harmful_content = "Hello <script>alert('xss')</script>"
        error = validate_message_content(harmful_content, "user", "chat")
        assert "potentially harmful code" in error
    
    def test_validate_message_content_javascript_url(self):
        """Test validation catches javascript URLs."""
        harmful_content = "Click here: javascript:alert('xss')"
        error = validate_message_content(harmful_content, "user", "chat")
        assert "potentially harmful code" in error
    
    def test_validate_message_content_repeated_characters(self):
        """Test validation catches excessive repeated characters."""
        spam_content = "a" * 25  # More than 20 repeated characters
        error = validate_message_content(spam_content, "user", "chat")
        assert "excessive repeated characters" in error
    
    def test_validate_message_content_valid(self):
        """Test validation passes for valid content."""
        error = validate_message_content("Hello, this is a valid message!", "user", "chat")
        assert error is None
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting functionality."""
        user_id = 1
        connection_id = "test_conn"
        
        # First 30 messages should pass
        for i in range(30):
            limited = await is_rate_limited(user_id, connection_id)
            assert not limited
        
        # 31st message should be rate limited
        limited = await is_rate_limited(user_id, connection_id)
        assert limited


class TestWebSocketEnhancedMessaging:
    """Test enhanced WebSocket messaging features."""
    
    @pytest.mark.asyncio
    async def test_message_validation_in_websocket(self, db_session, override_get_db):
        """Test that message validation works in WebSocket context."""
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
        
        # Test enhanced validation
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Test invalid role
                websocket.send_json({
                    "type": "send_message",
                    "content": "Hello",
                    "role": "invalid_role"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "Invalid role" in error_data["message"]
                
                # Test harmful content
                websocket.send_json({
                    "type": "send_message",
                    "content": "Hello <script>alert('xss')</script>",
                    "role": "user"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "harmful code" in error_data["message"]
    
    @pytest.mark.asyncio
    async def test_message_history_request(self, db_session, override_get_db):
        """Test requesting message history via WebSocket."""
        # Setup user and conversation
        user = User(
            username="history_user",
            display_name="History User",
            email="history@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="History Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add some messages
        messages = []
        for i in range(5):
            msg = Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content=f"Message {i+1}"
            )
            messages.append(msg)
        
        db_session.add_all(messages)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "history_user",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test message history request
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Request message history
                websocket.send_json({
                    "type": "request_message_history",
                    "limit": 3,
                    "offset": 0
                })
                
                # Should receive history response
                history_data = websocket.receive_json()
                assert history_data["type"] == "message_history"
                assert len(history_data["messages"]) == 3
                assert "has_more" in history_data
                
                # Check message format
                first_message = history_data["messages"][0]
                assert "id" in first_message
                assert "content" in first_message
                assert "from_user_username" in first_message
                assert "timestamp" in first_message
    
    @pytest.mark.asyncio
    async def test_mark_messages_read(self, db_session, override_get_db):
        """Test marking messages as read via WebSocket."""
        # Setup
        user = User(
            username="reader",
            display_name="Reader",
            email="reader@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Read Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add participant
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user.id,
            role="owner"
        )
        db_session.add(participant)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "reader",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test mark messages read
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Mark messages as read
                websocket.send_json({
                    "type": "mark_messages_read"
                })
                
                # Should receive confirmation
                read_data = websocket.receive_json()
                assert read_data["type"] == "messages_marked_read"
                assert read_data["conversation_id"] == conversation.id
                assert "timestamp" in read_data
    
    @pytest.mark.asyncio
    async def test_visitor_message_notification(self, db_session, override_get_db):
        """Test visitor message notification to conversation owner."""
        # Setup owner and visitor
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com"
        )
        owner.set_password("password")
        
        visitor = User(
            username="visitor",
            display_name="Visitor",
            email="visitor@example.com"
        )
        visitor.set_password("password")
        
        db_session.add_all([owner, visitor])
        await db_session.commit()
        
        conversation = Conversation(
            user_id=owner.id,
            title="Visitor Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add participants
        participants = [
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=owner.id,
                role="owner"
            ),
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=visitor.id,
                role="visitor"
            )
        ]
        db_session.add_all(participants)
        await db_session.commit()
        
        # Get auth tokens
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            owner_login = await client.post("/api/auth/login", json={
                "username": "owner",
                "password": "password"
            })
            owner_token = owner_login.json()["access_token"]
            
            visitor_login = await client.post("/api/auth/login", json={
                "username": "visitor",
                "password": "password"
            })
            visitor_token = visitor_login.json()["access_token"]
        
        # Test visitor message creates notification
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={owner_token}"
            ) as owner_ws, client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={visitor_token}"
            ) as visitor_ws:
                # Clear initial messages
                owner_ws.receive_json()  # connection_established
                visitor_ws.receive_json()  # connection_established
                owner_ws.receive_json()  # user_joined (visitor)
                visitor_ws.receive_json()  # user_joined (owner)
                
                # Visitor sends message
                visitor_ws.send_json({
                    "type": "send_message",
                    "content": "Hello, I have a question about this conversation",
                    "role": "user",
                    "message_type": "chat"
                })
                
                # Owner should receive the regular broadcast
                message_data = owner_ws.receive_json()
                assert message_data["type"] == "new_message"
                
                # Owner should also receive visitor notification
                notification_data = owner_ws.receive_json()
                assert notification_data["type"] == "visitor_message_notification"
                assert notification_data["from_user"] == "visitor"
                assert "question about this" in notification_data["message_preview"]
    
    @pytest.mark.asyncio
    async def test_invalid_message_structure(self, db_session, override_get_db):
        """Test handling of invalid message structures."""
        # Setup
        user = User(
            username="struct_test",
            display_name="Structure Test",
            email="struct@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Structure Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "struct_test",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test invalid message structures
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Test message without type
                websocket.send_json({
                    "content": "Hello",
                    "role": "user"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "Message type is required" in error_data["message"]
                
                # Test unknown message type
                websocket.send_json({
                    "type": "unknown_type",
                    "content": "Hello"
                })
                
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "Unknown message type" in error_data["message"]


class TestWebSocketParentMessageValidation:
    """Test parent message validation for threading."""
    
    @pytest.mark.asyncio
    async def test_valid_parent_message(self, db_session, override_get_db):
        """Test threading with valid parent message."""
        # Setup
        user = User(
            username="threader",
            display_name="Threader",
            email="threader@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Threading Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add a parent message
        parent_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Original message"
        )
        db_session.add(parent_message)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "threader",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test threading with valid parent
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Send reply to parent message
                websocket.send_json({
                    "type": "send_message",
                    "content": "This is a reply",
                    "role": "user",
                    "parent_message_id": parent_message.id
                })
                
                # Should receive the message successfully
                message_data = websocket.receive_json()
                assert message_data["type"] == "new_message"
                assert message_data["message"]["parent_message_id"] == parent_message.id
    
    @pytest.mark.asyncio
    async def test_invalid_parent_message(self, db_session, override_get_db):
        """Test threading with invalid parent message."""
        # Setup
        user = User(
            username="invalid_threader",
            display_name="Invalid Threader",
            email="invalid_threader@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Invalid Threading Test",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Get auth token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            login_response = await client.post("/api/auth/login", json={
                "username": "invalid_threader",
                "password": "password"
            })
            token = login_response.json()["access_token"]
        
        # Test threading with non-existent parent
        with TestClient(app) as client:
            with client.websocket_connect(
                f"/api/ws/conversations/{conversation.id}?token={token}"
            ) as websocket:
                # Receive connection established
                websocket.receive_json()
                
                # Send reply to non-existent parent message
                websocket.send_json({
                    "type": "send_message",
                    "content": "This is a reply to nothing",
                    "role": "user",
                    "parent_message_id": 99999  # Non-existent
                })
                
                # Should receive error
                error_data = websocket.receive_json()
                assert error_data["type"] == "error"
                assert "Parent message not found" in error_data["message"]