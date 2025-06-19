import pytest
from app.models import User, Conversation, Message
from app.services.summary_service import summary_service
from app.services.vector_service import vector_service


class TestEmbeddingIntegration:
    """Test integration between summary generation and embedding storage."""
    
    @pytest.mark.asyncio
    async def test_summary_generates_embedding(self, db_session):
        """Test that generating a summary also creates an embedding."""
        # Create user
        user = User(
            username="embedtest",
            display_name="Embed Test",
            email="embed@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation with enough tokens to trigger summary
        conversation = Conversation(
            user_id=user.id,
            title="Embedding Test Conversation",
            token_count=1500
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add messages
        user_message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="What is machine learning and how does it work in practice?"
        )
        
        ai_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content="Machine learning is a field of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task. It works by training algorithms on large datasets to recognize patterns."
        )
        
        db_session.add_all([user_message, ai_message])
        await db_session.commit()
        
        # Generate summary (should also create embedding)
        summary = await summary_service.check_and_generate_summary(conversation.id, db_session)
        
        assert summary is not None
        assert conversation.summary_raw is not None
        assert conversation.summary_public is not None
        
        # Check that embedding was created in ChromaDB
        search_results = vector_service.semantic_search("machine learning", limit=5)
        
        # Should find our conversation
        assert search_results['total_found'] > 0
        
        # Find our specific conversation in results
        found_conversation = False
        for i, conv_id in enumerate(search_results['results']['ids'][0]):
            if int(conv_id) == conversation.id:
                found_conversation = True
                metadata = search_results['results']['metadatas'][0][i]
                assert metadata['username'] == user.username
                assert metadata['display_name'] == user.display_name
                assert metadata['title'] == conversation.title
                break
        
        assert found_conversation, "Generated conversation not found in ChromaDB"
    
    @pytest.mark.asyncio
    async def test_pii_filtered_in_embeddings(self, db_session):
        """Test that PII is filtered out of embeddings."""
        # Create user
        user = User(
            username="piiembed",
            display_name="PII Embed",
            email="piiembed@example.com"
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
            content="Please send information to john.doe@company.com and call me at 555-123-4567"
        )
        
        ai_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content="I'll make sure to contact john.doe@company.com at 555-123-4567 with the information."
        )
        
        db_session.add_all([user_message, ai_message])
        await db_session.commit()
        
        # Generate summary and embedding
        await summary_service.check_and_generate_summary(conversation.id, db_session)
        
        # Search for the conversation
        search_results = vector_service.semantic_search("contact information", limit=5)
        
        # Find our conversation and check that PII is filtered
        found_conversation = False
        for i, conv_id in enumerate(search_results['results']['ids'][0]):
            if int(conv_id) == conversation.id:
                found_conversation = True
                document = search_results['results']['documents'][0][i]
                
                # Check that PII is filtered in the embedding
                assert "john.doe@company.com" not in document
                assert "555-123-4567" not in document
                assert "[email]" in document
                assert "[phone]" in document
                break
        
        assert found_conversation, "PII conversation not found in ChromaDB"
    
    @pytest.mark.asyncio
    async def test_force_summary_creates_embedding(self, db_session):
        """Test that force generating a summary also creates embeddings."""
        # Create user
        user = User(
            username="forceembed",
            display_name="Force Embed",
            email="forceembed@example.com"
        )
        user.set_password("password")
        db_session.add(user)
        await db_session.commit()
        
        # Create conversation below token threshold
        conversation = Conversation(
            user_id=user.id,
            title="Force Embed Test",
            token_count=500  # Below 1500 threshold
        )
        db_session.add(conversation)
        await db_session.commit()
        
        # Add a simple message
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id,
            role="user",
            content="Simple test question about Python programming"
        )
        db_session.add(message)
        await db_session.commit()
        
        # Force generate summary
        summary = await summary_service.force_generate_summary(conversation.id, db_session)
        
        assert summary is not None
        
        # Check that embedding was created
        search_results = vector_service.semantic_search("Python programming", limit=5)
        
        found_conversation = False
        for i, conv_id in enumerate(search_results['results']['ids'][0]):
            if int(conv_id) == conversation.id:
                found_conversation = True
                break
        
        assert found_conversation, "Force-generated conversation not found in ChromaDB"
    
    def test_vector_service_pagination(self):
        """Test pagination functionality in vector service."""
        # Clear any existing data first
        try:
            vector_service.client.delete_collection(vector_service.collection_name)
        except:
            pass
        vector_service.get_or_create_collection()
        
        # Test with no results
        results = vector_service.semantic_search("nonexistent topic", limit=10, offset=0)
        assert results['total_found'] == 0
        assert not results['has_more']
        
        # Test pagination logic with mock data
        # This would require existing data in ChromaDB, so we test the structure
        assert 'results' in results
        assert 'total_found' in results
        assert 'has_more' in results
    
    def test_vector_service_discovery_feed(self):
        """Test discovery feed functionality."""
        # Get recent conversations
        feed_results = vector_service.get_nearest_conversations(limit=10)
        
        assert 'results' in feed_results
        assert 'total_found' in feed_results
        assert isinstance(feed_results['results']['ids'], list)
        assert isinstance(feed_results['results']['documents'], list)
        assert isinstance(feed_results['results']['metadatas'], list)


class TestVectorServiceMethods:
    """Test individual vector service methods."""
    
    def test_store_conversation_summary_basic(self):
        """Test basic conversation summary storage."""
        test_metadata = {
            "user_id": 1,
            "username": "testuser",
            "display_name": "Test User",
            "title": "Test Conversation",
            "created_at": "2025-06-18T10:00:00Z"
        }
        
        success = vector_service.store_conversation_summary(
            conversation_id=999,
            summary="This is a test summary about machine learning concepts.",
            metadata=test_metadata
        )
        
        assert success
        
        # Verify we can search for it
        search_results = vector_service.semantic_search("machine learning", limit=5)
        
        found = False
        for conv_id in search_results['results']['ids'][0]:
            if conv_id == "999":
                found = True
                break
        
        assert found, "Test conversation not found after storage"
        
        # Clean up
        try:
            collection = vector_service.get_or_create_collection()
            collection.delete(ids=["999"])
        except:
            pass  # Cleanup failure is not critical for test
    
    def test_metadata_processing(self):
        """Test metadata processing for ChromaDB compatibility."""
        test_metadata = {
            "string_field": "test",
            "int_field": 123,
            "float_field": 45.6,
            "bool_field": True,
            "list_field": ["item1", "item2"],
            "dict_field": {"nested": "value"}
        }
        
        processed = vector_service._process_metadata(test_metadata)
        
        assert processed["string_field"] == "test"
        assert processed["int_field"] == 123
        assert processed["float_field"] == 45.6
        assert processed["bool_field"] is True
        assert processed["list_field"] == "item1,item2"
        assert '"nested"' in processed["dict_field"]  # Should be JSON string