import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.models import User, Conversation, Message, ConversationParticipant
from app.main import app


class TestConversationAPI:
    """Test cases for conversation API endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_conversation(self, db_session, override_get_db):
        """Test creating a new conversation."""
        # Create user
        user = User(
            username="creator",
            display_name="Creator User",
            email="creator@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login to get token
            login_response = await client.post("/api/auth/login", json={
                "username": "creator",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Create conversation
            response = await client.post(
                "/api/conversations/",
                json={
                    "title": "My Test Conversation",
                    "is_public": True
                },
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My Test Conversation"
        assert data["is_public"] is True
        assert data["user_id"] == user.id
        assert data["token_count"] == 0
        assert data["view_count"] == 0
        
        # Verify conversation was created in database
        result = await db_session.execute(
            select(Conversation).where(Conversation.id == data["id"])
        )
        conversation = result.scalar_one()
        assert conversation.title == "My Test Conversation"
        
        # Verify owner participant was created
        participant_result = await db_session.execute(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation.id)
        )
        participant = participant_result.scalar_one()
        assert participant.user_id == user.id
        assert participant.role == "owner"
    
    @pytest.mark.asyncio
    async def test_get_conversation_details(self, db_session, override_get_db):
        """Test getting conversation details with messages."""
        # Setup users and conversation
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
            title="Test Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add some messages
        messages = [
            Message(
                conversation_id=conversation.id,
                from_user_id=owner.id,
                role="user",
                content="Hello AI"
            ),
            Message(
                conversation_id=conversation.id,
                from_user_id=None,
                role="assistant",
                content="Hello! How can I help?"
            )
        ]
        db_session.add_all(messages)
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
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as visitor
            login_response = await client.post("/api/auth/login", json={
                "username": "visitor",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Get conversation details
            response = await client.get(
                f"/api/conversations/{conversation.id}",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Conversation"
        assert data["participant_count"] == 2
        assert len(data["messages"]) == 2
        
        # Check message details
        first_message = data["messages"][0]
        assert first_message["content"] == "Hello AI"
        assert first_message["role"] == "user"
        assert first_message["from_user_username"] == "owner"
        
        second_message = data["messages"][1]
        assert second_message["content"] == "Hello! How can I help?"
        assert second_message["role"] == "assistant"
        assert second_message["from_user_username"] is None  # AI message
    
    @pytest.mark.asyncio
    async def test_join_conversation(self, db_session, override_get_db):
        """Test joining a public conversation."""
        # Setup
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com"
        )
        owner.set_password("password")
        joiner = User(
            username="joiner",
            display_name="Joiner",
            email="joiner@example.com"
        )
        joiner.set_password("password")
        db_session.add_all([owner, joiner])
        await db_session.commit()
        
        conversation = Conversation(
            user_id=owner.id,
            title="Public Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as joiner
            login_response = await client.post("/api/auth/login", json={
                "username": "joiner",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Join conversation
            response = await client.post(
                f"/api/conversations/{conversation.id}/join",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "Successfully joined" in data["message"]
        
        # Verify participant was created
        participant_result = await db_session.execute(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation.id)
            .where(ConversationParticipant.user_id == joiner.id)
        )
        participant = participant_result.scalar_one()
        assert participant.role == "visitor"
    
    @pytest.mark.asyncio
    async def test_join_private_conversation_fails(self, db_session, override_get_db):
        """Test that joining private conversation fails."""
        # Setup
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
        
        conversation = Conversation(
            user_id=owner.id,
            title="Private Conversation",
            is_public=False  # Private
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as outsider
            login_response = await client.post("/api/auth/login", json={
                "username": "outsider",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Try to join private conversation
            response = await client.post(
                f"/api/conversations/{conversation.id}/join",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 403
        assert "Cannot join private conversation" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_leave_conversation(self, db_session, override_get_db):
        """Test leaving a conversation."""
        # Setup
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
            title="Test Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add visitor as participant
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=visitor.id,
            role="visitor"
        )
        db_session.add(participant)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as visitor
            login_response = await client.post("/api/auth/login", json={
                "username": "visitor",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Leave conversation
            response = await client.delete(
                f"/api/conversations/{conversation.id}/leave",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        assert "Successfully left" in response.json()["message"]
        
        # Verify participant was removed
        participant_result = await db_session.execute(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation.id)
            .where(ConversationParticipant.user_id == visitor.id)
        )
        assert participant_result.scalar_one_or_none() is None
    
    @pytest.mark.asyncio
    async def test_owner_cannot_leave_conversation(self, db_session, override_get_db):
        """Test that conversation owner cannot leave their own conversation."""
        # Setup
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com",
        )
        owner.set_password("password")
        db_session.add(owner)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=owner.id,
            title="Owner's Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=owner.id,
            role="owner"
        )
        db_session.add(participant)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as owner
            login_response = await client.post("/api/auth/login", json={
                "username": "owner",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Try to leave own conversation
            response = await client.delete(
                f"/api/conversations/{conversation.id}/leave",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 400
        assert "owner cannot leave" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_get_conversation_participants(self, db_session, override_get_db):
        """Test getting list of conversation participants."""
        # Setup
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
            title="Multi-Participant Conversation",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
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
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as visitor
            login_response = await client.post("/api/auth/login", json={
                "username": "visitor",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Get participants
            response = await client.get(
                f"/api/conversations/{conversation.id}/participants",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # Check owner participant
        owner_participant = next(p for p in data if p["role"] == "owner")
        assert owner_participant["username"] == "owner"
        assert owner_participant["display_name"] == "Owner"
        
        # Check visitor participant
        visitor_participant = next(p for p in data if p["role"] == "visitor")
        assert visitor_participant["username"] == "visitor"
        assert visitor_participant["display_name"] == "Visitor"
    
    @pytest.mark.asyncio
    async def test_archive_conversation(self, db_session, override_get_db):
        """Test manually archiving a conversation."""
        # Setup
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com",
        )
        owner.set_password("password")
        db_session.add(owner)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=owner.id,
            title="To Be Archived",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as owner
            login_response = await client.post("/api/auth/login", json={
                "username": "owner",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Archive conversation
            response = await client.post(
                f"/api/conversations/{conversation.id}/archive",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        assert "archived successfully" in response.json()["message"]
        
        # Verify conversation is archived
        await db_session.refresh(conversation)
        assert conversation.is_archived()
        assert conversation.archived_at is not None
    
    @pytest.mark.asyncio
    async def test_hide_conversation_from_profile(self, db_session, override_get_db):
        """Test hiding conversation from user profile."""
        # Setup
        owner = User(
            username="owner",
            display_name="Owner",
            email="owner@example.com",
        )
        owner.set_password("password")
        db_session.add(owner)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=owner.id,
            title="To Be Hidden",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as owner
            login_response = await client.post("/api/auth/login", json={
                "username": "owner",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # Hide conversation from profile
            response = await client.put(
                f"/api/conversations/{conversation.id}/hide",
                json={"is_hidden_from_profile": True},
                headers={"Authorization": f"Bearer {token}"}
            )
        
        assert response.status_code == 200
        assert "hidden from profile" in response.json()["message"]
        
        # Verify conversation is hidden
        await db_session.refresh(conversation)
        assert conversation.is_hidden_from_profile is True
    
    @pytest.mark.asyncio
    async def test_list_user_conversations(self, db_session, override_get_db):
        """Test listing user's conversations with pagination."""
        # Setup
        user = User(
            username="user",
            display_name="User",
            email="user@example.com",
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create multiple conversations
        conversations = []
        for i in range(5):
            conv = Conversation(
                user_id=user.id,
                title=f"Conversation {i+1}",
                is_public=i % 2 == 0  # Alternate public/private
            )
            conversations.append(conv)
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Login as user
            login_response = await client.post("/api/auth/login", json={
                "username": "user",
                "password": "password"
            })
            token = login_response.json()["access_token"]
            
            # List all conversations
            response = await client.get(
                "/api/conversations/",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 5
            assert len(data["conversations"]) == 5
            assert data["page"] == 1
            assert data["per_page"] == 20
            assert data["has_next"] is False
            
            # Test public_only filter
            public_response = await client.get(
                "/api/conversations/?public_only=true",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert public_response.status_code == 200
            public_data = public_response.json()
            assert public_data["total"] == 3  # 3 public conversations (0, 2, 4)
            assert len(public_data["conversations"]) == 3
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, override_get_db):
        """Test that endpoints require authentication."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Try to create conversation without auth
            response = await client.post(
                "/api/conversations/",
                json={"title": "Test", "is_public": True}
            )
            assert response.status_code == 403
            
            # Try to get conversation without auth
            response = await client.get("/api/conversations/1")
            assert response.status_code == 403
            
            # Try to list conversations without auth
            response = await client.get("/api/conversations/")
            assert response.status_code == 403