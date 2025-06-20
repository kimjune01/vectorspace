"""
Tests for social features models.
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.exc import IntegrityError
from app.models import (
    User, Conversation, Follow, SavedConversation, Collection, 
    CollectionItem, HumanMessage, Collaborator, Notification
)


class TestFollowModel:
    """Test Follow model functionality."""
    
    @pytest.mark.asyncio
    async def test_create_follow_relationship(self, db_session, test_users):
        """Test creating a follow relationship."""
        alice, bob = test_users[:2]
        
        follow = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow)
        await db_session.commit()
        
        assert follow.id is not None
        assert follow.follower_id == alice.id
        assert follow.following_id == bob.id
        assert follow.created_at is not None
    
    @pytest.mark.asyncio
    async def test_follow_relationship_unique_constraint(self, db_session, test_users):
        """Test that follow relationships are unique."""
        alice, bob = test_users[:2]
        
        # Create first follow
        follow1 = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow1)
        await db_session.commit()
        
        # Try to create duplicate follow
        follow2 = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow2)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_follow_relationships(self, db_session, test_users):
        """Test follow relationship queries."""
        alice, bob = test_users[:2]
        
        follow = Follow(follower_id=alice.id, following_id=bob.id)
        db_session.add(follow)
        await db_session.commit()
        await db_session.refresh(follow)
        
        assert follow.follower.username == alice.username
        assert follow.following.username == bob.username


class TestSavedConversationModel:
    """Test SavedConversation model functionality."""
    
    @pytest.mark.asyncio
    async def test_save_conversation(self, db_session, test_user, test_conversation):
        """Test saving a conversation."""
        saved = SavedConversation(
            user_id=test_user.id,
            conversation_id=test_conversation.id,
            tags=["ai", "ethics"],
            personal_note="Interesting discussion about AI ethics"
        )
        db_session.add(saved)
        await db_session.commit()
        
        assert saved.id is not None
        assert saved.user_id == test_user.id
        assert saved.conversation_id == test_conversation.id
        assert saved.tags == ["ai", "ethics"]
        assert saved.personal_note == "Interesting discussion about AI ethics"
        assert saved.saved_at is not None
    
    @pytest.mark.asyncio
    async def test_saved_conversation_unique_constraint(self, db_session, test_user, test_conversation):
        """Test that saved conversations are unique per user."""
        # Create first saved conversation
        saved1 = SavedConversation(user_id=test_user.id, conversation_id=test_conversation.id)
        db_session.add(saved1)
        await db_session.commit()
        
        # Try to save same conversation again
        saved2 = SavedConversation(user_id=test_user.id, conversation_id=test_conversation.id)
        db_session.add(saved2)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_saved_conversation_relationships(self, db_session, test_user, test_conversation):
        """Test saved conversation relationships."""
        saved = SavedConversation(user_id=test_user.id, conversation_id=test_conversation.id)
        db_session.add(saved)
        await db_session.commit()
        await db_session.refresh(saved)
        
        assert saved.user.username == test_user.username
        assert saved.conversation.title == test_conversation.title


class TestCollectionModel:
    """Test Collection and CollectionItem models."""
    
    @pytest.mark.asyncio
    async def test_create_collection(self, db_session, test_user):
        """Test creating a collection."""
        collection = Collection(
            user_id=test_user.id,
            name="AI Ethics Discussions",
            description="Curated conversations about AI ethics",
            is_public=True
        )
        db_session.add(collection)
        await db_session.commit()
        
        assert collection.id is not None
        assert collection.user_id == test_user.id
        assert collection.name == "AI Ethics Discussions"
        assert collection.description == "Curated conversations about AI ethics"
        assert collection.is_public is True
        assert collection.created_at is not None
        assert collection.updated_at is not None
    
    @pytest.mark.asyncio
    async def test_collection_with_items(self, db_session, test_user, test_conversations):
        """Test collection with items."""
        collection = Collection(
            user_id=test_user.id,
            name="Test Collection",
            is_public=True
        )
        db_session.add(collection)
        await db_session.flush()  # Get collection ID
        
        # Add items to collection
        for i, conversation in enumerate(test_conversations[:3]):
            item = CollectionItem(
                collection_id=collection.id,
                conversation_id=conversation.id,
                order_index=i
            )
            db_session.add(item)
        
        await db_session.commit()
        await db_session.refresh(collection)
        
        # Check collection items count through a separate query to avoid lazy loading issues
        from sqlalchemy import select
        result = await db_session.execute(
            select(CollectionItem).where(CollectionItem.collection_id == collection.id)
        )
        items = result.scalars().all()
        
        assert len(items) == 3
        assert items[0].order_index == 0
        assert items[1].order_index == 1
        assert items[2].order_index == 2


class TestHumanMessageModel:
    """Test HumanMessage model functionality."""
    
    @pytest.mark.asyncio
    async def test_create_human_message(self, db_session, test_user, test_conversation):
        """Test creating a human message."""
        message = HumanMessage(
            conversation_id=test_conversation.id,
            user_id=test_user.id,
            content="This is a great discussion!"
        )
        db_session.add(message)
        await db_session.commit()
        
        assert message.id is not None
        assert message.conversation_id == test_conversation.id
        assert message.user_id == test_user.id
        assert message.content == "This is a great discussion!"
        assert message.sent_at is not None
        assert message.expires_at is not None
    
    def test_human_message_expiration(self, test_user, test_conversation):
        """Test human message expiration logic."""
        message = HumanMessage(
            conversation_id=test_conversation.id,
            user_id=test_user.id,
            content="Test message"
        )
        
        # Should default to 30 days from now
        expected_expiry = datetime.utcnow() + timedelta(days=30)
        assert abs((message.expires_at - expected_expiry).total_seconds()) < 60  # Within 1 minute
        
        # Test is_expired method
        assert not message.is_expired()
        
        # Test with past expiration
        past_message = HumanMessage(
            conversation_id=test_conversation.id,
            user_id=test_user.id,
            content="Expired message",
            expires_at=datetime.utcnow() - timedelta(days=1)
        )
        assert past_message.is_expired()
    
    @pytest.mark.asyncio
    async def test_human_message_relationships(self, db_session, test_user, test_conversation):
        """Test human message relationships."""
        message = HumanMessage(
            conversation_id=test_conversation.id,
            user_id=test_user.id,
            content="Test message"
        )
        db_session.add(message)
        await db_session.commit()
        await db_session.refresh(message)
        
        assert message.user.username == test_user.username
        assert message.conversation.title == test_conversation.title


class TestCollaboratorModel:
    """Test Collaborator model functionality."""
    
    @pytest.mark.asyncio
    async def test_create_collaborator(self, db_session, test_users, test_conversation):
        """Test creating a collaborator."""
        alice, bob = test_users[:2]
        
        collaborator = Collaborator(
            conversation_id=test_conversation.id,
            user_id=bob.id,
            invited_by_id=alice.id,
            can_suggest_prompts=True
        )
        db_session.add(collaborator)
        await db_session.commit()
        
        assert collaborator.id is not None
        assert collaborator.conversation_id == test_conversation.id
        assert collaborator.user_id == bob.id
        assert collaborator.invited_by_id == alice.id
        assert collaborator.invited_at is not None
        assert collaborator.accepted_at is None
        assert collaborator.left_at is None
        assert collaborator.can_suggest_prompts is True
    
    @pytest.mark.asyncio
    async def test_collaborator_unique_constraint(self, db_session, test_users, test_conversation):
        """Test that collaborators are unique per conversation."""
        alice, bob = test_users[:2]
        
        # Create first collaborator
        collaborator1 = Collaborator(
            conversation_id=test_conversation.id,
            user_id=bob.id,
            invited_by_id=alice.id
        )
        db_session.add(collaborator1)
        await db_session.commit()
        
        # Try to add same user as collaborator again
        collaborator2 = Collaborator(
            conversation_id=test_conversation.id,
            user_id=bob.id,
            invited_by_id=alice.id
        )
        db_session.add(collaborator2)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()
    
    @pytest.mark.asyncio
    async def test_collaborator_lifecycle(self, db_session, test_users, test_conversation):
        """Test collaborator acceptance and leaving."""
        alice, bob = test_users[:2]
        
        collaborator = Collaborator(
            conversation_id=test_conversation.id,
            user_id=bob.id,
            invited_by_id=alice.id
        )
        db_session.add(collaborator)
        await db_session.commit()
        
        # Initially not active
        assert not collaborator.is_active()
        
        # Accept invitation
        collaborator.accept_invitation()
        await db_session.commit()
        
        assert collaborator.accepted_at is not None
        assert collaborator.is_active()
        
        # Leave collaboration
        collaborator.leave_collaboration()
        await db_session.commit()
        
        assert collaborator.left_at is not None
        assert not collaborator.is_active()
    
    @pytest.mark.asyncio
    async def test_collaborator_relationships(self, db_session, test_users, test_conversation):
        """Test collaborator relationships."""
        alice, bob = test_users[:2]
        
        collaborator = Collaborator(
            conversation_id=test_conversation.id,
            user_id=bob.id,
            invited_by_id=alice.id
        )
        db_session.add(collaborator)
        await db_session.commit()
        await db_session.refresh(collaborator)
        
        assert collaborator.user.username == bob.username
        assert collaborator.invited_by.username == alice.username
        assert collaborator.conversation.title == test_conversation.title


class TestNotificationModel:
    """Test Notification model functionality."""
    
    @pytest.mark.asyncio
    async def test_create_notification(self, db_session, test_users, test_conversation):
        """Test creating a notification."""
        alice, bob = test_users[:2]
        
        notification = Notification(
            user_id=alice.id,
            type="follow",
            title="New Follower",
            content=f"{bob.display_name} started following you",
            related_user_id=bob.id,
            topic_tags=["ai", "ethics"]
        )
        db_session.add(notification)
        await db_session.commit()
        
        assert notification.id is not None
        assert notification.user_id == alice.id
        assert notification.type == "follow"
        assert notification.title == "New Follower"
        assert notification.related_user_id == bob.id
        assert notification.topic_tags == ["ai", "ethics"]
        assert notification.created_at is not None
        assert notification.read_at is None
    
    @pytest.mark.asyncio
    async def test_notification_read_status(self, db_session, test_user):
        """Test notification read status methods."""
        notification = Notification(
            user_id=test_user.id,
            type="test",
            title="Test Notification",
            content="Test content"
        )
        db_session.add(notification)
        await db_session.commit()
        
        # Initially unread
        assert not notification.is_read()
        
        # Mark as read
        notification.mark_as_read()
        await db_session.commit()
        
        assert notification.read_at is not None
        assert notification.is_read()
    
    @pytest.mark.asyncio
    async def test_notification_relationships(self, db_session, test_users, test_conversation):
        """Test notification relationships."""
        alice, bob = test_users[:2]
        
        notification = Notification(
            user_id=alice.id,
            type="collaboration_invite",
            title="Collaboration Invite",
            content=f"{bob.display_name} invited you to collaborate",
            related_user_id=bob.id,
            related_conversation_id=test_conversation.id
        )
        db_session.add(notification)
        await db_session.commit()
        await db_session.refresh(notification)
        
        assert notification.user.username == alice.username
        assert notification.related_user.username == bob.username
        assert notification.related_conversation.title == test_conversation.title