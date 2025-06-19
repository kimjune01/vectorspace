import pytest
from app.models import User, Conversation, Message
from app.services.summary_service import SummaryService


class TestSummaryService:
    """Test summary generation functionality."""
    
    @pytest.mark.asyncio
    async def test_generate_extractive_summary_single_question(self, db_session):
        """Test summary generation for single question conversation."""
        # Create user
        user = User(
            username="summarytest",
            display_name="Summary Test",
            email="summary@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="Test Conversation",
            token_count=1500  # Trigger summary
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add messages
        user_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="What is machine learning and how does it work?"
        )
        
        ai_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content="Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task."
        )
        
        db_session.add_all([user_message, ai_message])
        await db_session.commit()
        
        # Test summary generation
        service = SummaryService()
        summary = await service.generate_summary(conversation.id, db_session)
        
        assert summary is not None
        assert "machine learning" in summary.lower()
        assert "User asked:" in summary
        assert "AI provided:" in summary
        assert len(summary) <= 2000  # Should be reasonably sized
    
    @pytest.mark.asyncio
    async def test_generate_summary_multiple_questions(self, db_session):
        """Test summary generation for multi-question conversation."""
        # Create user
        user = User(
            username="multitest",
            display_name="Multi Test", 
            email="multi@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="Multi Question Test",
            token_count=1600
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add multiple messages
        messages = [
            Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content="What is Python?"
            ),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content="Python is a high-level programming language."
            ),
            Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content="How do I use decorators?"
            ),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content="Decorators are functions that modify other functions."
            ),
            Message(
                conversation_id=conversation.id,
                from_user_id=user.id,
                role="user",
                content="Can you show me an example?"
            ),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content="Here's a simple decorator example: @property"
            )
        ]
        
        db_session.add_all(messages)
        await db_session.commit()
        
        # Test summary generation
        service = SummaryService()
        summary = await service.generate_summary(conversation.id, db_session)
        
        assert summary is not None
        assert "3 questions" in summary
        assert "Python" in summary
        assert "Decorators" in summary
        assert "6 messages" in summary
    
    @pytest.mark.asyncio
    async def test_check_and_generate_summary_threshold(self, db_session):
        """Test that summary is only generated when token threshold is met."""
        # Create user and conversation below threshold
        user = User(
            username="threshold",
            display_name="Threshold",
            email="threshold@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Below Threshold",
            token_count=1000  # Below 1500 threshold
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add a message
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Short question"
        )
        db_session.add(message)
        await db_session.commit()
        
        # Test that no summary is generated
        service = SummaryService()
        summary = await service.check_and_generate_summary(conversation.id, db_session)
        
        assert summary is None
        assert conversation.summary_raw is None
        
        # Update to meet threshold
        conversation.token_count = 1500
        await db_session.commit()
        
        # Now summary should be generated
        summary = await service.check_and_generate_summary(conversation.id, db_session)
        assert summary is not None
        assert conversation.summary_raw is not None
        assert conversation.summary_public is not None
    
    @pytest.mark.asyncio
    async def test_force_generate_summary(self, db_session):
        """Test force generation regardless of token count."""
        # Create user and conversation below threshold
        user = User(
            username="force",
            display_name="Force",
            email="force@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Force Test",
            token_count=500  # Well below threshold
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add a message
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Force summary test question"
        )
        db_session.add(message)
        await db_session.commit()
        
        # Force generate summary
        service = SummaryService()
        summary = await service.force_generate_summary(conversation.id, db_session)
        
        assert summary is not None
        assert conversation.summary_raw is not None
        assert conversation.summary_public is not None
    
    @pytest.mark.asyncio
    async def test_pii_filtering_in_summary(self, db_session):
        """Test that PII is filtered in public summary."""
        # Create user
        user = User(
            username="piitest",
            display_name="PII Test",
            email="pii@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation
        conversation = Conversation(
            user_id=user.id,
            title="PII Test",
            token_count=1500
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add message with PII
        user_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Please email me at john.doe@company.com about this topic"
        )
        
        ai_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content="I'll make sure to send information to john.doe@company.com"
        )
        
        db_session.add_all([user_message, ai_message])
        await db_session.commit()
        
        # Generate summary
        service = SummaryService()
        await service.check_and_generate_summary(conversation.id, db_session)
        
        # Check that raw summary contains PII
        assert "john.doe@company.com" in conversation.summary_raw
        
        # Check that public summary has PII filtered
        assert "[email]" in conversation.summary_public
        assert "john.doe@company.com" not in conversation.summary_public
    
    def test_truncate_text(self):
        """Test text truncation utility."""
        service = SummaryService()
        
        # Short text - no truncation
        short_text = "This is short"
        assert service._truncate_text(short_text, 100) == short_text
        
        # Long text - truncation at word boundary
        long_text = "This is a very long text that should be truncated at a reasonable word boundary"
        truncated = service._truncate_text(long_text, 30)
        assert len(truncated) <= 34  # 30 + "..."
        assert truncated.endswith("...")
        assert not truncated.endswith(" ...")  # Should not end with space before dots
    
    def test_estimate_summary_tokens(self):
        """Test token estimation for summaries."""
        service = SummaryService()
        
        summary = "This is a test summary with approximately twenty tokens in total length."
        token_count = service.estimate_summary_tokens(summary)
        
        assert token_count > 0
        assert isinstance(token_count, int)
        # Should be around 17-18 tokens for this text
        assert 15 <= token_count <= 20


class TestSummaryServiceEdgeCases:
    """Test edge cases for summary service."""
    
    @pytest.mark.asyncio
    async def test_empty_conversation(self, db_session):
        """Test summary generation for conversation with no messages."""
        user = User(
            username="empty",
            display_name="Empty",
            email="empty@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="Empty Conversation",
            token_count=1500
        )
        db_session.add(conversation)
        await db_session.commit()
        
        service = SummaryService()
        summary = await service.generate_summary(conversation.id, db_session)
        
        assert summary is None
    
    @pytest.mark.asyncio
    async def test_system_messages_only(self, db_session):
        """Test summary generation for conversation with only system messages."""
        user = User(
            username="system",
            display_name="System",
            email="system@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        conversation = Conversation(
            user_id=user.id,
            title="System Only",
            token_count=1500
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add only system message
        system_message = Message(
            conversation_id=conversation.id,
            role="system",
            content="System initialized"
        )
        db_session.add(system_message)
        await db_session.commit()
        
        service = SummaryService()
        summary = await service.generate_summary(conversation.id, db_session)
        
        assert summary == "System conversation with no user input."
    
    @pytest.mark.asyncio
    async def test_nonexistent_conversation(self, db_session):
        """Test summary generation for non-existent conversation."""
        service = SummaryService()
        summary = await service.check_and_generate_summary(99999, db_session)
        
        assert summary is None