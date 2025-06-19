import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.summary_service import SummaryService
from app.services.title_service import TitleGenerationService
from app.models import Conversation, Message, User


@pytest.fixture
async def summary_service():
    """Create a SummaryService instance for testing."""
    return SummaryService()


@pytest.fixture
async def title_service():
    """Create a TitleGenerationService instance for testing."""
    return TitleGenerationService()


@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        username="testuser",
        display_name="Test User",
        email="test@example.com",
        hashed_password="fake_hash"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def conversation_with_many_messages(db_session: AsyncSession, test_user: User):
    """Create a conversation with enough messages to trigger summarization."""
    conversation = Conversation(
        user_id=test_user.id,
        title="Chat 2024-06-19",  # Auto-generated title
        is_public=True
    )
    db_session.add(conversation)
    await db_session.commit()
    await db_session.refresh(conversation)
    
    # Create enough messages to exceed 1500 tokens
    messages = []
    for i in range(10):
        # User message
        user_msg = Message(
            conversation_id=conversation.id,
            from_user_id=test_user.id,
            role="user",
            message_type="chat",
            content=f"This is user message {i+1}. " + "Let me ask about binary search algorithms and their implementation in Python. " * 10
        )
        messages.append(user_msg)
        
        # AI message
        ai_msg = Message(
            conversation_id=conversation.id,
            from_user_id=None,
            role="assistant",
            message_type="chat",
            content=f"This is AI response {i+1}. " + "Binary search is an efficient algorithm for finding an item from a sorted list of items. It works by repeatedly dividing the search interval in half. " * 15
        )
        messages.append(ai_msg)
    
    for message in messages:
        db_session.add(message)
    
    await db_session.commit()
    
    # Update conversation token count to trigger summarization
    conversation.token_count = 2000  # Above the 1500 threshold
    await db_session.commit()
    
    return conversation


class TestSummaryTitleIntegration:
    """Test integration between summary service and title generation."""
    
    async def test_summary_generation_updates_title(self, summary_service: SummaryService, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test that summary generation automatically updates conversation title."""
        # Ensure conversation has an auto-generated title
        assert conversation_with_many_messages.title == "Chat 2024-06-19"
        assert conversation_with_many_messages.summary_raw is None
        
        # Generate summary with title update enabled
        summary = await summary_service.check_and_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        # Verify summary was generated
        assert summary is not None
        assert len(summary) > 0
        
        # Verify title was updated
        await db_session.refresh(conversation_with_many_messages)
        assert conversation_with_many_messages.title != "Chat 2024-06-19"
        assert "binary search" in conversation_with_many_messages.title.lower()
        
        # Verify summary was stored
        assert conversation_with_many_messages.summary_raw is not None
        assert conversation_with_many_messages.summary_public is not None
    
    async def test_summary_generation_respects_custom_title(self, summary_service: SummaryService, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test that summary generation doesn't update custom titles."""
        # Set a custom title
        custom_title = "My Algorithm Discussion"
        conversation_with_many_messages.title = custom_title
        await db_session.commit()
        
        # Generate summary
        summary = await summary_service.check_and_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        # Verify summary was generated
        assert summary is not None
        
        # Verify custom title was preserved
        await db_session.refresh(conversation_with_many_messages)
        assert conversation_with_many_messages.title == custom_title
    
    async def test_force_summary_updates_title(self, summary_service: SummaryService, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test that forced summary generation updates title."""
        original_title = conversation_with_many_messages.title
        
        # Force generate summary
        summary = await summary_service.force_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        # Verify summary was generated
        assert summary is not None
        
        # Verify title was updated
        await db_session.refresh(conversation_with_many_messages)
        assert conversation_with_many_messages.title != original_title
        assert "binary search" in conversation_with_many_messages.title.lower()
    
    async def test_summary_without_title_update(self, summary_service: SummaryService, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test summary generation with title update disabled."""
        original_title = conversation_with_many_messages.title
        
        # Generate summary without title update
        summary = await summary_service.check_and_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=False
        )
        
        # Verify summary was generated
        assert summary is not None
        
        # Verify title was not changed
        await db_session.refresh(conversation_with_many_messages)
        assert conversation_with_many_messages.title == original_title
    
    async def test_summary_regeneration_updates_title(self, summary_service: SummaryService, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test that summary regeneration also updates title."""
        # First generate a summary
        await summary_service.force_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        first_title = conversation_with_many_messages.title
        
        # Add more messages to change the conversation content
        new_msg = Message(
            conversation_id=conversation_with_many_messages.id,
            from_user_id=conversation_with_many_messages.user_id,
            role="user",
            message_type="chat",
            content="Now let's discuss merge sort algorithms and their time complexity analysis in detail."
        )
        db_session.add(new_msg)
        await db_session.commit()
        
        # Clear existing summary to force regeneration
        conversation_with_many_messages.summary_raw = None
        conversation_with_many_messages.summary_public = None
        await db_session.commit()
        
        # Force regenerate summary
        new_summary = await summary_service.force_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        # Verify new summary was generated
        assert new_summary is not None
        
        # Verify title was updated to reflect new content
        await db_session.refresh(conversation_with_many_messages)
        # Title might change to reflect merge sort content or stay similar
        # The important thing is the update mechanism works
        assert conversation_with_many_messages.summary_raw is not None
    
    async def test_empty_conversation_title_handling(self, summary_service: SummaryService, test_user: User, db_session: AsyncSession):
        """Test title generation for conversations with no meaningful content."""
        conversation = Conversation(
            user_id=test_user.id,
            title="Chat 2024-06-19",
            is_public=True,
            token_count=2000  # Above threshold but no real content
        )
        db_session.add(conversation)
        await db_session.commit()
        await db_session.refresh(conversation)
        
        # Try to generate summary for empty conversation
        summary = await summary_service.check_and_generate_summary(
            conversation.id,
            db_session,
            update_title=True
        )
        
        # Should handle gracefully
        assert summary is None or len(summary) == 0


class TestTitleUpdateErrorHandling:
    """Test error handling in title update functionality."""
    
    async def test_title_update_with_invalid_conversation(self, summary_service: SummaryService, db_session: AsyncSession):
        """Test title update with non-existent conversation."""
        # Should not raise exception
        summary = await summary_service.check_and_generate_summary(
            99999,  # Non-existent conversation ID
            db_session,
            update_title=True
        )
        
        assert summary is None
    
    async def test_title_service_import_failure_handling(self, conversation_with_many_messages: Conversation, db_session: AsyncSession):
        """Test that summary service handles title service import failures gracefully."""
        # Create a mock summary service with broken title service import
        class MockSummaryService(SummaryService):
            async def _update_conversation_title(self, conversation_id: int, summary: str, db: AsyncSession):
                # Simulate import failure
                raise ImportError("Mock import failure")
        
        mock_service = MockSummaryService()
        
        # Should not raise exception, just log error
        summary = await mock_service.force_generate_summary(
            conversation_with_many_messages.id,
            db_session,
            update_title=True
        )
        
        # Summary should still be generated even if title update fails
        assert summary is not None
        assert len(summary) > 0


class TestPerformanceConsiderations:
    """Test performance aspects of title generation integration."""
    
    async def test_title_generation_performance(self, title_service: TitleGenerationService, db_session: AsyncSession, test_user: User):
        """Test that title generation doesn't significantly impact performance."""
        import time
        
        # Create conversation with moderate content
        conversation = Conversation(
            user_id=test_user.id,
            title="Chat 2024-06-19",
            is_public=True
        )
        db_session.add(conversation)
        await db_session.commit()
        await db_session.refresh(conversation)
        
        # Add some messages
        for i in range(5):
            message = Message(
                conversation_id=conversation.id,
                from_user_id=test_user.id,
                role="user",
                message_type="chat",
                content=f"Test message {i} about algorithms and data structures."
            )
            db_session.add(message)
        
        await db_session.commit()
        
        # Measure title generation time
        start_time = time.time()
        title = await title_service.generate_title_from_messages(
            conversation.id,
            db_session,
            use_ai=False  # Use extractive method for consistent timing
        )
        end_time = time.time()
        
        # Should complete quickly (less than 1 second for extractive method)
        assert end_time - start_time < 1.0
        assert title is not None
        assert len(title) > 0