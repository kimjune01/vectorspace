import pytest
from datetime import datetime, timedelta
from app.models import User, Conversation, Message, PasswordResetToken
from app.services.background_tasks import BackgroundTaskService


class TestBackgroundTaskService:
    """Test background task service functionality."""
    
    @pytest.mark.asyncio
    async def test_auto_archive_by_token_count(self, db_session):
        """Test auto-archiving conversations with high token count."""
        # Create user
        user = User(
            username="archivetest",
            display_name="Archive Test",
            email="archive@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation with high token count
        conversation = Conversation(
            user_id=user.id,
            title="High Token Conversation",
            token_count=1500,  # Meets archiving threshold
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add some messages
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="This conversation should be archived due to high token count."
        )
        db_session.add(message)
        await db_session.commit()
        
        # Run auto-archiving
        service = BackgroundTaskService()
        archived_count = await service.auto_archive_conversations(db_session)
        
        # Check that conversation was archived
        assert archived_count == 1
        await db_session.refresh(conversation)
        assert conversation.is_archived()
        assert conversation.archived_at is not None
    
    @pytest.mark.asyncio
    async def test_auto_archive_by_inactivity(self, db_session):
        """Test auto-archiving conversations inactive for 24+ hours."""
        # Create user
        user = User(
            username="inactivetest",
            display_name="Inactive Test",
            email="inactive@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation with old last_message_at
        old_time = datetime.utcnow() - timedelta(hours=25)  # 25 hours ago
        conversation = Conversation(
            user_id=user.id,
            title="Inactive Conversation",
            token_count=500,  # Below token threshold
            last_message_at=old_time,
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add message
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="This conversation is inactive."
        )
        db_session.add(message)
        await db_session.commit()
        
        # Run auto-archiving
        service = BackgroundTaskService()
        archived_count = await service.auto_archive_conversations(db_session)
        
        # Check that conversation was archived
        assert archived_count == 1
        await db_session.refresh(conversation)
        assert conversation.is_archived()
    
    @pytest.mark.asyncio
    async def test_no_archive_active_conversation(self, db_session):
        """Test that active conversations below threshold are not archived."""
        # Create user
        user = User(
            username="activetest",
            display_name="Active Test",
            email="active@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create active conversation below thresholds
        conversation = Conversation(
            user_id=user.id,
            title="Active Conversation",
            token_count=500,  # Below token threshold
            last_message_at=datetime.utcnow(),  # Recent activity
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Run auto-archiving
        service = BackgroundTaskService()
        archived_count = await service.auto_archive_conversations(db_session)
        
        # Check that conversation was NOT archived
        assert archived_count == 0
        await db_session.refresh(conversation)
        assert not conversation.is_archived()
    
    @pytest.mark.asyncio
    async def test_update_user_stats(self, db_session):
        """Test user statistics update."""
        # Create user
        user = User(
            username="statstest",
            display_name="Stats Test",
            email="stats@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversations - some recent, some old
        recent_time = datetime.utcnow() - timedelta(hours=12)  # 12 hours ago
        old_time = datetime.utcnow() - timedelta(hours=48)     # 48 hours ago
        
        conversations = [
            Conversation(
                user_id=user.id,
                title="Recent Conversation 1",
                created_at=recent_time
            ),
            Conversation(
                user_id=user.id,
                title="Recent Conversation 2", 
                created_at=recent_time
            ),
            Conversation(
                user_id=user.id,
                title="Old Conversation",
                created_at=old_time
            )
        ]
        
        db_session.add_all(conversations)
        await db_session.commit()
        
        # Run user stats update
        service = BackgroundTaskService()
        updated_count = await service.update_user_stats(db_session)
        
        # Check that user stats were updated
        assert updated_count == 1
        await db_session.refresh(user)
        assert user.conversations_last_24h == 2  # Only recent conversations
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_tokens(self, db_session):
        """Test cleanup of expired password reset tokens."""
        # Create user
        user = User(
            username="tokentest",
            display_name="Token Test",
            email="token@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create expired and valid tokens
        expired_time = datetime.utcnow() - timedelta(hours=2)
        future_time = datetime.utcnow() + timedelta(hours=1)
        
        expired_token = PasswordResetToken(
            user_id=user.id,
            token="expired_token",
            expires_at=expired_time
        )
        
        valid_token = PasswordResetToken(
            user_id=user.id,
            token="valid_token",
            expires_at=future_time
        )
        
        db_session.add_all([expired_token, valid_token])
        await db_session.commit()
        
        # Run token cleanup
        service = BackgroundTaskService()
        cleaned_count = await service.cleanup_old_password_reset_tokens(db_session)
        
        # Check that expired token was cleaned up
        assert cleaned_count == 1
        
        # Verify expired token is gone, valid token remains
        from sqlalchemy import select
        remaining_tokens = await db_session.execute(
            select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )
        tokens = remaining_tokens.scalars().all()
        
        assert len(tokens) == 1
        assert tokens[0].token == "valid_token"
    
    @pytest.mark.asyncio
    async def test_run_maintenance_tasks(self, db_session):
        """Test running all maintenance tasks together."""
        # Create user
        user = User(
            username="maintenancetest",
            display_name="Maintenance Test",
            email="maintenance@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation that should be archived
        conversation = Conversation(
            user_id=user.id,
            title="Maintenance Test Conversation",
            token_count=1500,
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Create expired token
        expired_token = PasswordResetToken(
            user_id=user.id,
            token="maintenance_expired",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )
        db_session.add(expired_token)
        await db_session.commit()
        
        # Run all maintenance tasks
        service = BackgroundTaskService()
        results = await service.run_maintenance_tasks(db_session)
        
        # Check results
        assert "archived_conversations" in results
        assert "updated_user_stats" in results
        assert "cleaned_tokens" in results
        
        assert results["archived_conversations"] == 1
        assert results["updated_user_stats"] == 1
        assert results["cleaned_tokens"] == 1


class TestBackgroundTaskEdgeCases:
    """Test edge cases for background tasks."""
    
    @pytest.mark.asyncio
    async def test_archive_already_archived_conversation(self, db_session):
        """Test that already archived conversations are skipped."""
        # Create user
        user = User(
            username="skiptest",
            display_name="Skip Test",
            email="skip@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create already archived conversation
        conversation = Conversation(
            user_id=user.id,
            title="Already Archived",
            token_count=1500,
            archived_at=datetime.utcnow(),  # Already archived
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Run auto-archiving
        service = BackgroundTaskService()
        archived_count = await service.auto_archive_conversations(db_session)
        
        # Should not archive already archived conversation
        assert archived_count == 0
    
    @pytest.mark.asyncio
    async def test_archive_private_conversations(self, db_session):
        """Test that private conversations are not auto-archived."""
        # Create user
        user = User(
            username="privatetest",
            display_name="Private Test",
            email="private@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create private conversation with high token count
        conversation = Conversation(
            user_id=user.id,
            title="Private Conversation",
            token_count=1500,
            is_public=False  # Private conversation
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Run auto-archiving
        service = BackgroundTaskService()
        archived_count = await service.auto_archive_conversations(db_session)
        
        # Should not archive private conversation
        assert archived_count == 0
        await db_session.refresh(conversation)
        assert not conversation.is_archived()
    
    @pytest.mark.asyncio
    async def test_user_stats_no_conversations(self, db_session):
        """Test user stats update for user with no conversations."""
        # Create user with no conversations
        user = User(
            username="noconvtest",
            display_name="No Conv Test",
            email="noconv@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Run user stats update
        service = BackgroundTaskService()
        updated_count = await service.update_user_stats(db_session)
        
        # Should still update the user
        assert updated_count == 1
        await db_session.refresh(user)
        assert user.conversations_last_24h == 0