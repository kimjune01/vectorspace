import pytest
from app.models import Message, Conversation, User


class TestTokenCounting:
    """Test token counting functionality."""
    
    def test_estimate_token_count_empty(self):
        """Test token estimation for empty text."""
        assert Message.estimate_token_count("") == 0
        assert Message.estimate_token_count(None) == 0
    
    def test_estimate_token_count_basic(self):
        """Test basic token estimation."""
        # Simple text: "Hello world" = 11 chars -> ~3 tokens
        assert Message.estimate_token_count("Hello world") == 2  # 11//4 = 2
        
        # Longer text: ~16 chars -> 4 tokens
        assert Message.estimate_token_count("This is a test message") == 5  # 22//4 = 5
    
    def test_estimate_token_count_whitespace_handling(self):
        """Test that extra whitespace is handled properly."""
        # Multiple spaces should be normalized
        text1 = "Hello    world"
        text2 = "Hello world"
        assert Message.estimate_token_count(text1) == Message.estimate_token_count(text2)
    
    def test_estimate_token_count_minimum(self):
        """Test minimum token count is 1 for non-empty text."""
        # Very short text should still count as 1 token
        assert Message.estimate_token_count("Hi") == 1
        assert Message.estimate_token_count("a") == 1
    
    def test_message_auto_token_counting(self):
        """Test that messages automatically calculate token count."""
        message = Message(
            conversation_id=1,
            role="user",
            content="Hello, this is a test message!"
        )
        # "Hello, this is a test message!" = 31 chars -> 7 tokens
        assert message.token_count == 7
    
    def test_message_manual_token_count(self):
        """Test that manual token count overrides automatic calculation."""
        message = Message(
            conversation_id=1,
            role="user", 
            content="Hello world",
            token_count=10  # Override automatic calculation
        )
        assert message.token_count == 10
    
    def test_update_token_count(self):
        """Test updating token count after content changes."""
        message = Message(
            conversation_id=1,
            role="user",
            content="Short"
        )
        original_count = message.token_count
        
        # Update content
        message.content = "This is a much longer message with more tokens"
        message.update_token_count()
        
        assert message.token_count > original_count
        assert message.token_count == Message.estimate_token_count(message.content)
    
    @pytest.mark.asyncio
    async def test_conversation_token_counting(self, db_session):
        """Test conversation token counting integration."""
        # Create user
        user = User(
            username="tokentest",
            display_name="Token Test",
            email="token@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="Token Test Conversation"
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add messages
        message1 = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Hello, how are you today?"  # ~6 tokens
        )
        message2 = Message(
            conversation_id=conversation.id,
            role="assistant", 
            content="I'm doing well, thank you for asking! How can I help you?"  # ~14 tokens
        )
        
        db_session.add_all([message1, message2])
        await db_session.commit()
        
        # Update conversation token count
        conversation.token_count = message1.token_count + message2.token_count
        await db_session.commit()
        
        assert conversation.token_count > 0
        assert conversation.token_count == message1.token_count + message2.token_count
    
    def test_should_auto_archive_by_tokens(self):
        """Test conversation auto-archive logic based on token count."""
        conversation = Conversation(
            user_id=1,
            title="Test",
            token_count=1499
        )
        assert not conversation.should_auto_archive()
        
        conversation.token_count = 1500
        assert conversation.should_auto_archive()
        
        conversation.token_count = 2000
        assert conversation.should_auto_archive()


class TestTokenCountingEdgeCases:
    """Test edge cases for token counting."""
    
    def test_unicode_characters(self):
        """Test token counting with unicode characters."""
        # Emoji and special characters
        text = "Hello 👋 world 🌍!"
        count = Message.estimate_token_count(text)
        assert count > 0
        assert isinstance(count, int)
    
    def test_very_long_text(self):
        """Test token counting with very long text."""
        long_text = "This is a very long message. " * 100  # ~3000 chars
        count = Message.estimate_token_count(long_text)
        assert count > 700  # Should be around 750 tokens
        assert count < 800
    
    def test_special_characters(self):
        """Test token counting with special characters and punctuation."""
        text = "Hello, world! How are you? I'm fine. Thanks for asking..."
        count = Message.estimate_token_count(text)
        assert count > 0
        assert isinstance(count, int)
    
    def test_newlines_and_tabs(self):
        """Test token counting normalizes newlines and tabs."""
        text1 = "Hello\nworld\ttest"
        text2 = "Hello world test"
        assert Message.estimate_token_count(text1) == Message.estimate_token_count(text2)