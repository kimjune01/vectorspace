import pytest
import tempfile
import shutil
from pathlib import Path
from app.services.vector_service import VectorService


class TestVectorService:
    """Test cases for ChromaDB vector service."""
    
    @pytest.fixture
    def temp_db_path(self):
        """Create a temporary directory for ChromaDB testing."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def vector_service(self, temp_db_path):
        """Create a vector service instance for testing."""
        return VectorService(
            persist_directory=temp_db_path,
            collection_name="test_conversations"
        )
    
    def test_vector_service_initialization(self, vector_service):
        """Test that vector service initializes correctly."""
        assert vector_service.collection_name == "test_conversations"
        assert vector_service.client is not None
        assert vector_service.embedding_function is not None
    
    def test_get_or_create_collection(self, vector_service):
        """Test collection creation and retrieval."""
        collection = vector_service.get_or_create_collection()
        
        assert collection is not None
        assert collection.name == "test_conversations"
        
        # Should return same collection on second call
        collection2 = vector_service.get_or_create_collection()
        assert collection.name == collection2.name
    
    def test_add_conversation_summary(self, vector_service):
        """Test adding a conversation summary to the vector database."""
        conversation_id = "conv_001"
        summary = "User discussed Python decorators and how they work"
        metadata = {
            "user_id": "user123",
            "conversation_id": conversation_id,
            "timestamp": "2025-06-18T10:00:00Z",
            "topics": ["python", "decorators"],
            "token_count": 450
        }
        
        # Add the conversation
        vector_service.add_conversation_summary(
            conversation_id=conversation_id,
            summary=summary,
            metadata=metadata
        )
        
        # Verify it was added by querying
        collection = vector_service.get_or_create_collection()
        result = collection.get(ids=[conversation_id])
        
        assert len(result["ids"]) == 1
        assert result["ids"][0] == conversation_id
        assert result["documents"][0] == summary
        assert result["metadatas"][0]["user_id"] == "user123"
        assert result["metadatas"][0]["topics"] == "python,decorators"  # List converted to string
    
    def test_search_similar_conversations(self, vector_service):
        """Test semantic search for similar conversations."""
        # Add some test conversations
        conversations = [
            {
                "id": "conv_001",
                "summary": "User asked about Python decorators and their use cases",
                "metadata": {"user_id": "user1", "topics": "python,decorators"}
            },
            {
                "id": "conv_002", 
                "summary": "Discussion about JavaScript async/await patterns",
                "metadata": {"user_id": "user2", "topics": "javascript,async"}
            },
            {
                "id": "conv_003",
                "summary": "How to use Python function decorators for logging",
                "metadata": {"user_id": "user3", "topics": "python,decorators,logging"}
            }
        ]
        
        for conv in conversations:
            vector_service.add_conversation_summary(
                conversation_id=conv["id"],
                summary=conv["summary"],
                metadata=conv["metadata"]
            )
        
        # Search for decorator-related conversations
        results = vector_service.search_similar_conversations(
            query="Python decorator examples",
            n_results=2
        )
        
        assert "ids" in results
        assert len(results["ids"][0]) == 2  # Should return 2 results
        
        # Should return decorator-related conversations
        returned_ids = results["ids"][0]
        assert "conv_001" in returned_ids or "conv_003" in returned_ids
    
    def test_search_with_metadata_filter(self, vector_service):
        """Test searching with metadata filtering."""
        # Add conversations from different users
        conversations = [
            {
                "id": "conv_001",
                "summary": "Python decorators discussion",
                "metadata": {"user_id": "user1", "topics": "python"}
            },
            {
                "id": "conv_002",
                "summary": "More Python decorators examples", 
                "metadata": {"user_id": "user2", "topics": "python"}
            }
        ]
        
        for conv in conversations:
            vector_service.add_conversation_summary(
                conversation_id=conv["id"],
                summary=conv["summary"],
                metadata=conv["metadata"]
            )
        
        # Search with user filter
        results = vector_service.search_similar_conversations(
            query="Python decorators",
            n_results=5,
            metadata_filter={"user_id": "user1"}
        )
        
        # Should only return user1's conversation
        assert len(results["ids"][0]) == 1
        assert results["ids"][0][0] == "conv_001"
        assert results["metadatas"][0][0]["user_id"] == "user1"
    
    def test_update_conversation_summary(self, vector_service):
        """Test updating an existing conversation summary."""
        conversation_id = "conv_001"
        original_summary = "Initial summary about Python"
        updated_summary = "Updated summary about Python decorators with examples"
        
        metadata = {
            "user_id": "user123",
            "conversation_id": conversation_id,
            "timestamp": "2025-06-18T10:00:00Z"
        }
        
        # Add original
        vector_service.add_conversation_summary(
            conversation_id=conversation_id,
            summary=original_summary,
            metadata=metadata
        )
        
        # Update the summary
        updated_metadata = metadata.copy()
        updated_metadata["token_count"] = 500
        
        vector_service.update_conversation_summary(
            conversation_id=conversation_id,
            summary=updated_summary,
            metadata=updated_metadata
        )
        
        # Verify update
        collection = vector_service.get_or_create_collection()
        result = collection.get(ids=[conversation_id])
        
        assert result["documents"][0] == updated_summary
        assert result["metadatas"][0]["token_count"] == 500
    
    def test_delete_conversation(self, vector_service):
        """Test deleting a conversation from the vector database."""
        conversation_id = "conv_001"
        summary = "Test conversation to be deleted"
        metadata = {"user_id": "user123"}
        
        # Add conversation
        vector_service.add_conversation_summary(
            conversation_id=conversation_id,
            summary=summary,
            metadata=metadata
        )
        
        # Verify it exists
        collection = vector_service.get_or_create_collection()
        result = collection.get(ids=[conversation_id])
        assert len(result["ids"]) == 1
        
        # Delete it
        vector_service.delete_conversation(conversation_id)
        
        # Verify it's gone
        result = collection.get(ids=[conversation_id])
        assert len(result["ids"]) == 0
    
    def test_get_conversation_count(self, vector_service):
        """Test getting the total count of conversations."""
        # Initially should be 0
        assert vector_service.get_conversation_count() == 0
        
        # Add some conversations
        for i in range(3):
            vector_service.add_conversation_summary(
                conversation_id=f"conv_{i:03d}",
                summary=f"Test conversation {i}",
                metadata={"user_id": f"user{i}"}
            )
        
        # Should now be 3
        assert vector_service.get_conversation_count() == 3
    
    def test_get_user_conversations(self, vector_service):
        """Test getting all conversations for a specific user."""
        user_id = "user123"
        
        # Add conversations for different users
        conversations = [
            {"id": "conv_001", "user": "user123", "summary": "User 123 conversation 1"},
            {"id": "conv_002", "user": "user456", "summary": "User 456 conversation"},
            {"id": "conv_003", "user": "user123", "summary": "User 123 conversation 2"},
        ]
        
        for conv in conversations:
            vector_service.add_conversation_summary(
                conversation_id=conv["id"],
                summary=conv["summary"],
                metadata={"user_id": conv["user"]}
            )
        
        # Get conversations for user123
        user_conversations = vector_service.get_user_conversations(user_id)
        
        assert len(user_conversations["ids"]) == 2
        user_ids = [meta["user_id"] for meta in user_conversations["metadatas"]]
        assert all(uid == user_id for uid in user_ids)