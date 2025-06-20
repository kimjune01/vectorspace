import pytest
from datetime import datetime
from sqlalchemy import select
from app.models import User, Conversation, Message, ConversationParticipant

class TestUserModel:
    """Test cases for User model following TDD approach."""
    
    @pytest.mark.asyncio
    async def test_create_user_with_display_name(self, db_session, test_user_data):
        """Test creating a user with username, display name, and email."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hashed_password",
            bio=test_user_data["bio"]
        )
        
        db_session.add(user)
        await db_session.commit()
        
        # Verify user was created
        result = await db_session.execute(
            select(User).where(User.username == test_user_data["username"])
        )
        saved_user = result.scalar_one()
        
        assert saved_user.username == test_user_data["username"]
        assert saved_user.display_name == test_user_data["display_name"]
        assert saved_user.email == "test@example.com"
        assert saved_user.bio == test_user_data["bio"]
        assert saved_user.created_at is not None
        assert saved_user.conversation_count == 0
        assert saved_user.conversations_last_24h == 0
        assert saved_user.profile_image_url is None
        assert saved_user.stripe_pattern_seed is not None  # Should be auto-generated
    
    @pytest.mark.asyncio
    async def test_username_must_be_unique(self, db_session, test_user_data):
        """Test that usernames must be unique."""
        from sqlalchemy.exc import IntegrityError
        
        # Create first user
        user1 = User(
            username=test_user_data["username"],
            display_name="User One",
            email="user1@example.com",
            password_hash="hash1"
        )
        db_session.add(user1)
        await db_session.commit()
        
        # Try to create second user with same username
        user2 = User(
            username=test_user_data["username"],  # Same username
            display_name="User Two",
            email="user2@example.com",  # Different email
            password_hash="hash2"
        )
        db_session.add(user2)
        
        # Should raise integrity error
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_user_password_methods(self, test_user_data):
        """Test password hashing and verification methods."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com"
        )
        
        # Test password setting
        user.set_password(test_user_data["password"])
        assert user.password_hash is not None
        assert user.password_hash != test_user_data["password"]  # Should be hashed
        
        # Test password verification
        assert user.verify_password(test_user_data["password"]) is True
        assert user.verify_password("wrongpassword") is False
    
    @pytest.mark.asyncio
    async def test_email_must_be_unique(self, db_session):
        """Test that emails must be unique."""
        from sqlalchemy.exc import IntegrityError
        
        # Create first user
        user1 = User(
            username="user1",
            display_name="User One",
            email="test@example.com",
            password_hash="hash1"
        )
        db_session.add(user1)
        await db_session.commit()
        
        # Try to create second user with same email
        user2 = User(
            username="user2",  # Different username
            display_name="User Two",
            email="test@example.com",  # Same email
            password_hash="hash2"
        )
        db_session.add(user2)
        
        # Should raise integrity error
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_stripe_pattern_seed_generation(self, db_session):
        """Test that stripe pattern seeds are automatically generated and unique."""
        user1 = User(
            username="user1",
            display_name="User One",
            email="user1@example.com",
            password_hash="hash1"
        )
        user2 = User(
            username="user2",
            display_name="User Two", 
            email="user2@example.com",
            password_hash="hash2"
        )
        
        db_session.add_all([user1, user2])
        await db_session.commit()
        
        assert user1.stripe_pattern_seed is not None
        assert user2.stripe_pattern_seed is not None
        assert user1.stripe_pattern_seed != user2.stripe_pattern_seed  # Should be unique
        assert isinstance(user1.stripe_pattern_seed, int)
        assert isinstance(user2.stripe_pattern_seed, int)


class TestConversationModel:
    """Test cases for Conversation model."""
    
    @pytest.mark.asyncio
    async def test_create_conversation(self, db_session, test_user_data):
        """Test creating a conversation linked to a user."""
        # First create a user
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="Test Conversation",
            is_public=True  # Default should be True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        assert conversation.id is not None
        assert conversation.user_id == user.id
        assert conversation.is_public is True
        assert conversation.created_at is not None
        assert conversation.last_message_at is not None
        assert conversation.view_count == 0
        assert conversation.token_count == 0
        assert conversation.archived_at is None  # Should not be archived initially
        assert conversation.is_hidden_from_profile is False  # Should be visible by default
    
    @pytest.mark.asyncio
    async def test_conversation_summaries(self, db_session, test_user_data):
        """Test that conversations can store both raw and filtered summaries."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Email Discussion",
            summary_raw="Contact me at user@example.com for details",
            summary_public="Contact me at [email] for details"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        assert conversation.summary_raw != conversation.summary_public
        assert "[email]" in conversation.summary_public
        assert "user@example.com" not in conversation.summary_public
    
    @pytest.mark.asyncio
    async def test_conversation_archiving(self, db_session, test_user_data):
        """Test conversation archiving functionality."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Test Conversation",
            token_count=1500  # Over 1000 tokens
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Initially not archived
        assert conversation.archived_at is None
        assert not conversation.is_archived()
        
        # Archive the conversation
        conversation.archive()
        
        assert conversation.archived_at is not None
        assert conversation.is_archived()
    
    @pytest.mark.asyncio
    async def test_conversation_hiding_from_profile(self, db_session, test_user_data):
        """Test hiding conversations from user profile."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Private Conversation"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Initially visible on profile
        assert conversation.is_hidden_from_profile is False
        
        # Hide from profile
        conversation.hide_from_profile()
        assert conversation.is_hidden_from_profile is True
        
        # Show on profile again
        conversation.show_on_profile()
        assert conversation.is_hidden_from_profile is False
    
    @pytest.mark.asyncio
    async def test_conversation_token_counting(self, db_session, test_user_data):
        """Test conversation token counting and auto-archive logic."""
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Growing Conversation",
            token_count=500
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Should not trigger auto-archive yet
        assert not conversation.should_auto_archive()
        
        # Increase token count beyond threshold (1500+)
        conversation.token_count = 1600
        
        # Should trigger auto-archive now
        assert conversation.should_auto_archive()
    
    @pytest.mark.asyncio
    async def test_conversation_last_message_tracking(self, db_session, test_user_data):
        """Test that conversations track last message time for inactivity."""
        from datetime import datetime, timedelta
        
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation with old last message time
        old_time = datetime.utcnow() - timedelta(hours=25)  # 25 hours ago
        conversation = Conversation(
            user_id=user.id,
            title="Inactive Conversation",
            last_message_at=old_time
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Should be considered inactive
        assert conversation.is_inactive_for_24h()
        
        # Update last message time
        conversation.update_last_message_time()
        
        # Should no longer be inactive
        assert not conversation.is_inactive_for_24h()


class TestMessageModel:
    """Test cases for Message model."""
    
    @pytest.mark.asyncio
    async def test_create_message(self, db_session, test_user_data):
        """Test creating messages in a conversation."""
        # Setup user and conversation
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(user_id=user.id, title="Test Chat")
        db_session.add(conversation)
        await db_session.commit()
        
        # Create messages
        user_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Hello AI"
        )
        ai_message = Message(
            conversation_id=conversation.id,
            from_user_id=None,  # AI messages have no from_user_id
            role="assistant",
            content="Hello! How can I help?"
        )
        
        db_session.add_all([user_message, ai_message])
        await db_session.commit()
        
        # Verify messages
        messages = await db_session.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.timestamp)
        )
        messages_list = messages.scalars().all()
        
        assert len(messages_list) == 2
        assert messages_list[0].role == "user"
        assert messages_list[1].role == "assistant"
        assert messages_list[0].timestamp <= messages_list[1].timestamp
        assert all(msg.timestamp is not None for msg in messages_list)
        
        # Test extended fields
        assert messages_list[0].from_user_id == user.id
        assert messages_list[1].from_user_id is None  # AI message
        assert messages_list[0].token_count > 0  # Auto-calculated from content
        assert messages_list[0].message_type == "chat"  # Default
    
    @pytest.mark.asyncio
    async def test_message_types_and_roles(self, db_session, test_user_data):
        """Test different message types and role methods."""
        # Setup user and conversation
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(user_id=user.id, title="Test Types")
        db_session.add(conversation)
        await db_session.commit()
        
        # Create different message types
        user_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            message_type="chat",
            content="User message"
        )
        
        ai_message = Message(
            conversation_id=conversation.id,
            from_user_id=None,
            role="assistant",
            message_type="chat",
            content="AI response"
        )
        
        system_message = Message(
            conversation_id=conversation.id,
            from_user_id=None,
            role="system",
            message_type="system",
            content="System notification"
        )
        
        visitor_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            message_type="visitor_message",
            content="Visitor question"
        )
        
        db_session.add_all([user_message, ai_message, system_message, visitor_message])
        await db_session.commit()
        
        # Test role methods
        assert user_message.is_from_user()
        assert not user_message.is_from_ai()
        assert not user_message.is_system_message()
        assert not user_message.is_visitor_message()
        
        assert ai_message.is_from_ai()
        assert not ai_message.is_from_user()
        assert not ai_message.is_system_message()
        
        assert system_message.is_system_message()
        assert not system_message.is_from_user()
        assert not system_message.is_from_ai()
        
        assert visitor_message.is_visitor_message()
        assert visitor_message.is_from_user()  # Visitor is still a user
        assert not visitor_message.is_from_ai()
    
    @pytest.mark.asyncio
    async def test_message_threading(self, db_session, test_user_data):
        """Test message threading with replies."""
        # Setup
        user1 = User(
            username="user1",
            display_name="User One",
            email="user1@example.com",
            password_hash="hash"
        )
        user2 = User(
            username="user2", 
            display_name="User Two",
            email="user2@example.com",
            password_hash="hash"
        )
        db_session.add_all([user1, user2])
        await db_session.commit()
        
        conversation = Conversation(user_id=user1.id, title="Threading Test")
        db_session.add(conversation)
        await db_session.commit()
        
        # Create parent message
        parent_message = Message(
            conversation_id=conversation.id,
            from_user_id=user1.id,
            role="user",
            content="Original question"
        )
        db_session.add(parent_message)
        await db_session.commit()
        
        # Create reply using the helper method
        reply = parent_message.add_reply(
            reply_content="Reply to the question",
            from_user_id=user2.id,
            role="user"
        )
        db_session.add(reply)
        await db_session.commit()
        
        # Verify threading
        assert reply.parent_message_id == parent_message.id
        assert reply.conversation_id == conversation.id
        assert reply.from_user_id == user2.id
        assert reply.content == "Reply to the question"
        
        # Test relationship (query explicitly to avoid lazy loading issues)
        parent_result = await db_session.execute(
            select(Message).where(Message.id == parent_message.id)
        )
        parent = parent_result.scalar_one()
        
        replies_result = await db_session.execute(
            select(Message).where(Message.parent_message_id == parent.id)
        )
        replies = replies_result.scalars().all()
        
        assert len(replies) == 1
        assert replies[0].id == reply.id
    
    @pytest.mark.asyncio
    async def test_message_token_counting(self, db_session, test_user_data):
        """Test message token counting functionality."""
        # Setup
        user = User(
            username=test_user_data["username"],
            display_name=test_user_data["display_name"],
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(user_id=user.id, title="Token Test")
        db_session.add(conversation)
        await db_session.commit()
        
        # Create message with token count
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="This is a longer message that might have more tokens",
            token_count=15
        )
        db_session.add(message)
        await db_session.commit()
        
        assert message.token_count == 15
        
        # Test default token count
        default_message = Message(
            conversation_id=conversation.id,
            from_user_id=None,
            role="assistant",
            content="Short response"
        )
        db_session.add(default_message)
        await db_session.commit()
        
        assert default_message.token_count > 0  # Auto-calculated from content


class TestPasswordResetTokenModel:
    """Test cases for PasswordResetToken model."""
    
    @pytest.mark.asyncio
    async def test_create_password_reset_token(self, db_session):
        """Test creating a password reset token."""
        from app.models import PasswordResetToken
        
        # Create user first
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create password reset token
        reset_token = PasswordResetToken(
            user_id=user.id,
            token="secure-reset-token-123"
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        assert reset_token.id is not None
        assert reset_token.user_id == user.id
        assert reset_token.token == "secure-reset-token-123"
        assert reset_token.created_at is not None
        assert reset_token.expires_at is not None
        assert reset_token.used_at is None
        assert not reset_token.is_expired()
        assert not reset_token.is_used()
    
    @pytest.mark.asyncio
    async def test_password_reset_token_expiration(self, db_session):
        """Test password reset token expiration logic."""
        from app.models import PasswordResetToken
        from datetime import datetime, timedelta
        
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create expired token
        past_time = datetime.utcnow() - timedelta(hours=1)
        expired_token = PasswordResetToken(
            user_id=user.id,
            token="expired-token",
            expires_at=past_time
        )
        db_session.add(expired_token)
        await db_session.commit()
        
        assert expired_token.is_expired()
        assert not expired_token.is_valid()
    
    @pytest.mark.asyncio
    async def test_password_reset_token_usage(self, db_session):
        """Test marking password reset token as used."""
        from app.models import PasswordResetToken
        
        user = User(
            username="testuser",
            display_name="Test User",
            email="test@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        reset_token = PasswordResetToken(
            user_id=user.id,
            token="valid-token"
        )
        db_session.add(reset_token)
        await db_session.commit()
        
        # Initially not used
        assert not reset_token.is_used()
        assert reset_token.is_valid()
        
        # Mark as used
        reset_token.mark_as_used()
        
        assert reset_token.is_used()
        assert not reset_token.is_valid()  # Used tokens are invalid
        assert reset_token.used_at is not None
    
    @pytest.mark.asyncio
    async def test_generate_secure_token(self):
        """Test that secure tokens are generated properly."""
        from app.models import PasswordResetToken
        
        token1 = PasswordResetToken.generate_secure_token()
        token2 = PasswordResetToken.generate_secure_token()
        
        assert len(token1) >= 32  # Should be reasonably long
        assert len(token2) >= 32
        assert token1 != token2  # Should be unique
        assert token1.isalnum() or '-' in token1 or '_' in token1  # Should be URL-safe


class TestConversationParticipantModel:
    """Test cases for ConversationParticipant model."""
    
    @pytest.mark.asyncio
    async def test_create_conversation_participant(self, db_session):
        """Test creating a conversation participant."""
        # Create user
        user = User(
            username="participant1",
            display_name="Participant One",
            email="participant1@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="Test Conversation"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Create participant
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user.id,
            role="owner"
        )
        db_session.add(participant)
        await db_session.commit()
        
        assert participant.id is not None
        assert participant.conversation_id == conversation.id
        assert participant.user_id == user.id
        assert participant.role == "owner"
        assert participant.joined_at is not None
        assert participant.last_seen_at is not None
        assert participant.is_owner()
        assert not participant.is_visitor()
    
    @pytest.mark.asyncio
    async def test_conversation_participant_roles(self, db_session):
        """Test participant role functionality."""
        # Create user and conversation
        user = User(
            username="visitor1",
            display_name="Visitor One",
            email="visitor1@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Public Conversation"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Create visitor participant (default role)
        visitor = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user.id
        )
        db_session.add(visitor)
        await db_session.commit()
        
        assert visitor.role == "visitor"  # Default role
        assert visitor.is_visitor()
        assert not visitor.is_owner()
    
    @pytest.mark.asyncio
    async def test_update_last_seen(self, db_session):
        """Test updating participant's last seen timestamp."""
        from datetime import datetime, timedelta
        
        # Create user and conversation
        user = User(
            username="seenuser",
            display_name="Seen User",
            email="seen@example.com",
            password_hash="hash"
        )
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Seen Test"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Create participant with old last_seen time
        old_time = datetime.utcnow() - timedelta(hours=1)
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user.id,
            last_seen_at=old_time
        )
        db_session.add(participant)
        await db_session.commit()
        
        original_time = participant.last_seen_at
        
        # Update last seen
        participant.update_last_seen()
        
        assert participant.last_seen_at > original_time
    
    @pytest.mark.asyncio
    async def test_conversation_participants_relationship(self, db_session):
        """Test conversation-participants relationship."""
        # Create users
        owner = User(
            username="owner1",
            display_name="Owner",
            email="owner@example.com",
            password_hash="hash"
        )
        visitor1 = User(
            username="visitor1",
            display_name="Visitor 1",
            email="visitor1@example.com",
            password_hash="hash"
        )
        visitor2 = User(
            username="visitor2",
            display_name="Visitor 2",
            email="visitor2@example.com",
            password_hash="hash"
        )
        db_session.add_all([owner, visitor1, visitor2])
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=owner.id,
            title="Multi-Participant Conversation"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add participants
        owner_participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=owner.id,
            role="owner"
        )
        visitor1_participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=visitor1.id,
            role="visitor"
        )
        visitor2_participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=visitor2.id,
            role="visitor"
        )
        
        db_session.add_all([owner_participant, visitor1_participant, visitor2_participant])
        await db_session.commit()
        
        # Test relationship by querying participants
        result = await db_session.execute(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation.id)
        )
        participants = result.scalars().all()
        
        assert len(participants) == 3
        
        # Check roles
        roles = [p.role for p in participants]
        assert "owner" in roles
        assert roles.count("visitor") == 2
        
        # Check user access through participants
        user_ids = [p.user_id for p in participants]
        assert owner.id in user_ids
        assert visitor1.id in user_ids
        assert visitor2.id in user_ids