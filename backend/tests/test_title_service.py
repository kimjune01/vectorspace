import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.title_service import TitleGenerationService
from app.models import Conversation, Message, User
from app.database import get_test_db_session


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
async def test_conversation(db_session: AsyncSession, test_user: User):
    """Create a test conversation."""
    conversation = Conversation(
        user_id=test_user.id,
        title="Chat 2024-06-19",
        is_public=True
    )
    db_session.add(conversation)
    await db_session.commit()
    await db_session.refresh(conversation)
    return conversation


@pytest.fixture
async def conversation_with_messages(db_session: AsyncSession, test_conversation: Conversation):
    """Create a conversation with test messages."""
    messages = [
        Message(
            conversation_id=test_conversation.id,
            from_user_id=test_conversation.user_id,
            role="user",
            message_type="chat",
            content="How do I implement a binary search algorithm in Python?"
        ),
        Message(
            conversation_id=test_conversation.id,
            from_user_id=None,  # AI message
            role="assistant",
            message_type="chat",
            content="Here's how to implement binary search in Python:\n\n```python\ndef binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    \n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    \n    return -1\n```\n\nThis algorithm has O(log n) time complexity."
        ),
        Message(
            conversation_id=test_conversation.id,
            from_user_id=test_conversation.user_id,
            role="user",
            message_type="chat",
            content="Can you explain the time complexity in more detail?"
        ),
        Message(
            conversation_id=test_conversation.id,
            from_user_id=None,  # AI message
            role="assistant",
            message_type="chat",
            content="Binary search has O(log n) time complexity because it halves the search space with each iteration..."
        )
    ]
    
    for message in messages:
        db_session.add(message)
    
    await db_session.commit()
    return test_conversation


class TestTitleGenerationService:
    """Test cases for TitleGenerationService."""
    
    async def test_generate_extractive_title_single_message(self, title_service: TitleGenerationService):
        """Test extractive title generation with a single user message."""
        messages = [
            Message(
                conversation_id=1,
                from_user_id=1,
                role="user",
                message_type="chat",
                content="How do I implement a binary search algorithm in Python?"
            )
        ]
        
        title = title_service._generate_extractive_title(messages)
        assert title == "Implement a binary search algorithm in Python"
        assert len(title) <= 200
    
    async def test_generate_extractive_title_multiple_messages(self, title_service: TitleGenerationService):
        """Test extractive title generation with multiple user messages."""
        messages = [
            Message(
                conversation_id=1,
                from_user_id=1,
                role="user",
                message_type="chat",
                content="How do I implement a binary search algorithm?"
            ),
            Message(
                conversation_id=1,
                from_user_id=None,
                role="assistant",
                message_type="chat",
                content="Here's how to implement binary search..."
            ),
            Message(
                conversation_id=1,
                from_user_id=1,
                role="user",
                message_type="chat",
                content="Can you explain the time complexity?"
            )
        ]
        
        title = title_service._generate_extractive_title(messages)
        assert "binary search algorithm" in title.lower()
        assert "(+1 more)" in title
    
    async def test_generate_extractive_title_empty_messages(self, title_service: TitleGenerationService):
        """Test extractive title generation with no messages."""
        title = title_service._generate_extractive_title([])
        assert title == "Empty Conversation"
    
    async def test_generate_extractive_title_system_only(self, title_service: TitleGenerationService):
        """Test extractive title generation with system messages only."""
        messages = [
            Message(
                conversation_id=1,
                from_user_id=None,
                role="system",
                message_type="system",
                content="System message"
            )
        ]
        
        title = title_service._generate_extractive_title(messages)
        assert title == "System Conversation"
    
    async def test_extract_topic_from_text(self, title_service: TitleGenerationService):
        """Test topic extraction from text."""
        test_cases = [
            ("How to implement a binary search algorithm?", "implement a binary search algorithm"),
            ("What is the best way to learn Python?", "the best way to learn Python"),
            ("Can you help me with React components?", "help me with React components"),
            ("Please explain quantum computing", "explain quantum computing"),
            ("I want to understand machine learning", "understand machine learning"),
            ("Short", "Short"),
            ("", "General Discussion")
        ]
        
        for input_text, expected in test_cases:
            result = title_service._extract_topic_from_text(input_text)
            assert result == expected
    
    async def test_validate_and_clean_title(self, title_service: TitleGenerationService):
        """Test title validation and cleaning."""
        test_cases = [
            ("  multiple   spaces  ", "Multiple spaces"),
            ("lowercase title", "Lowercase title"),
            ("", "Untitled Conversation"),
            ("a", "Brief Conversation"),
            ("Title with punctuation!?", "Title with punctuation!?"),
            ("A" * 250, "A" * 197 + "...")  # Long title truncation
        ]
        
        for input_title, expected in test_cases:
            result = title_service._validate_and_clean_title(input_title)
            assert result == expected
            assert len(result) <= 200
    
    async def test_is_custom_title(self, title_service: TitleGenerationService):
        """Test custom title detection."""
        # Generic/auto-generated titles
        assert not title_service._is_custom_title("Chat 2024-06-19")
        assert not title_service._is_custom_title("Chat 12/25/2024")
        assert not title_service._is_custom_title("New Conversation")
        
        # Custom titles
        assert title_service._is_custom_title("My Python Project Discussion")
        assert title_service._is_custom_title("Binary Search Implementation Help")
        assert title_service._is_custom_title("Custom Title Here")
    
    async def test_generate_title_from_summary(self, title_service: TitleGenerationService):
        """Test title generation from summary using extractive method."""
        summary = "User asked: How do I implement a binary search algorithm in Python? AI provided: Here's how to implement binary search in Python with O(log n) time complexity. Conversation included 4 messages covering various aspects of the topic."
        
        title = await title_service.generate_title_from_summary(summary, use_ai=False)
        assert title is not None
        assert "implement a binary search algorithm in Python" in title.lower()
        assert len(title) <= 200
    
    async def test_generate_title_from_messages_extractive(self, title_service: TitleGenerationService, conversation_with_messages: Conversation, db_session: AsyncSession):
        """Test title generation from messages using extractive method."""
        title = await title_service.generate_title_from_messages(
            conversation_with_messages.id, 
            db_session, 
            use_ai=False
        )
        
        assert title is not None
        assert "binary search algorithm" in title.lower()
        assert len(title) <= 200
    
    async def test_update_conversation_title_auto_generated(self, title_service: TitleGenerationService, conversation_with_messages: Conversation, db_session: AsyncSession):
        """Test updating conversation title when it's auto-generated."""
        # Set an auto-generated title
        conversation_with_messages.title = "Chat 2024-06-19"
        await db_session.commit()
        
        new_title = await title_service.update_conversation_title(
            conversation_with_messages.id,
            db_session,
            force_update=False
        )
        
        assert new_title is not None
        assert new_title != "Chat 2024-06-19"
        assert "binary search" in new_title.lower()
        
        # Verify database was updated
        await db_session.refresh(conversation_with_messages)
        assert conversation_with_messages.title == new_title
    
    async def test_update_conversation_title_custom_title(self, title_service: TitleGenerationService, conversation_with_messages: Conversation, db_session: AsyncSession):
        """Test that custom titles are not updated without force_update."""
        # Set a custom title
        custom_title = "My Custom Algorithm Discussion"
        conversation_with_messages.title = custom_title
        await db_session.commit()
        
        new_title = await title_service.update_conversation_title(
            conversation_with_messages.id,
            db_session,
            force_update=False
        )
        
        # Should not update custom title
        assert new_title is None
        
        # Verify database was not updated
        await db_session.refresh(conversation_with_messages)
        assert conversation_with_messages.title == custom_title
    
    async def test_update_conversation_title_force_update(self, title_service: TitleGenerationService, conversation_with_messages: Conversation, db_session: AsyncSession):
        """Test forced update of custom titles."""
        # Set a custom title
        custom_title = "My Custom Algorithm Discussion"
        conversation_with_messages.title = custom_title
        await db_session.commit()
        
        new_title = await title_service.update_conversation_title(
            conversation_with_messages.id,
            db_session,
            force_update=True
        )
        
        # Should update even custom title when forced
        assert new_title is not None
        assert new_title != custom_title
        assert "binary search" in new_title.lower()
        
        # Verify database was updated
        await db_session.refresh(conversation_with_messages)
        assert conversation_with_messages.title == new_title
    
    async def test_update_conversation_title_nonexistent(self, title_service: TitleGenerationService, db_session: AsyncSession):
        """Test updating title for non-existent conversation."""
        new_title = await title_service.update_conversation_title(
            99999,  # Non-existent ID
            db_session
        )
        
        assert new_title is None


class TestTitleServiceIntegration:
    """Integration tests for title service with other components."""
    
    async def test_title_length_limits(self, title_service: TitleGenerationService):
        """Test that generated titles respect length limits."""
        # Create a very long message
        long_content = "How do I implement " + "a very long and complex " * 20 + "algorithm in Python?"
        messages = [
            Message(
                conversation_id=1,
                from_user_id=1,
                role="user",
                message_type="chat",
                content=long_content
            )
        ]
        
        title = title_service._generate_extractive_title(messages)
        assert len(title) <= 200
        assert title.endswith("...") or len(title) < 200
    
    async def test_title_special_characters(self, title_service: TitleGenerationService):
        """Test title generation with special characters."""
        messages = [
            Message(
                conversation_id=1,
                from_user_id=1,
                role="user",
                message_type="chat",
                content="How to handle UTF-8 encoding: émojis 🚀 and special chars?"
            )
        ]
        
        title = title_service._generate_extractive_title(messages)
        assert title is not None
        assert len(title) <= 200
        # Should handle unicode characters properly
        assert "UTF-8 encoding" in title or "handle UTF-8" in title