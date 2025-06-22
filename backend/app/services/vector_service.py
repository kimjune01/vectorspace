import chromadb
from chromadb.utils import embedding_functions
from chromadb.api.types import EmbeddingFunction
from typing import Dict, List, Optional, Any
import logging
import os
import numpy as np

logger = logging.getLogger(__name__)


class TestEmbeddingFunction(EmbeddingFunction):
    """Simple embedding function for testing that doesn't require API calls."""
    
    def name(self) -> str:
        """Return the name of the embedding function."""
        return "test_embedding"
    
    def __call__(self, input: List[str]) -> List[List[float]]:
        """Generate simple hash-based embeddings for testing."""
        embeddings = []
        for text in input:
            # Create a simple deterministic embedding based on text hash
            hash_val = hash(text)
            # Convert to a fixed-size embedding (384 dimensions like sentence transformers)
            embedding = []
            for i in range(384):
                # Use hash + index to create pseudo-random but deterministic values
                val = ((hash_val + i) % 10000) / 10000.0 - 0.5
                embedding.append(val)
            embeddings.append(embedding)
        return embeddings


class VectorService:
    """Service for managing conversation embeddings with ChromaDB."""
    
    def __init__(
        self, 
        persist_directory: str = "./chroma_db",
        collection_name: str = "conversation_summaries",
        embedding_model: str = "text-embedding-3-small"
    ):
        """
        Initialize the vector service.
        
        Args:
            persist_directory: Directory to persist ChromaDB data
            collection_name: Name of the ChromaDB collection
            embedding_model: OpenAI embedding model for embeddings
        """
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Initialize ChromaDB's free default embedding function
        # This provides high-quality embeddings without API costs
        if os.getenv("TESTING") == "1":
            # For tests, use simple test embedding function for deterministic results
            logger.info("Using test embedding function for testing environment")
            self.embedding_function = TestEmbeddingFunction()
        else:
            # Use ChromaDB's free default embedding function (all-MiniLM-L6-v2)
            self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
            logger.info("VectorService initialized with ChromaDB default embeddings (all-MiniLM-L6-v2)")
        
        logger.info(f"VectorService initialized with collection: {collection_name}")
    
    def _process_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process metadata to ensure ChromaDB compatibility.
        ChromaDB only supports str, int, float, bool values.
        """
        processed = {}
        for key, value in metadata.items():
            if value is None:
                # Skip None values as ChromaDB doesn't handle them well
                continue
            elif isinstance(value, list):
                # Convert lists to comma-separated strings
                processed[key] = ",".join(str(item) for item in value)
            elif isinstance(value, dict):
                # Convert dicts to JSON strings
                import json
                processed[key] = json.dumps(value)
            elif isinstance(value, (str, int, float, bool)):
                processed[key] = value
            else:
                # Convert other types to strings
                processed[key] = str(value)
        return processed
    
    def get_or_create_collection(self):
        """Get or create the ChromaDB collection."""
        # For testing, create collection without embedding function to avoid issues
        if os.getenv("TESTING") == "1":
            return self.client.get_or_create_collection(
                name=self.collection_name
            )
        else:
            return self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function
            )
    
    def add_conversation_summary(
        self,
        conversation_id: str,
        summary: str,
        metadata: Dict[str, Any]
    ) -> None:
        """
        Add a conversation summary to the vector database.
        
        Args:
            conversation_id: Unique identifier for the conversation
            summary: The conversation summary text
            metadata: Additional metadata about the conversation
        """
        collection = self.get_or_create_collection()
        
        # Convert metadata to ChromaDB-compatible format
        processed_metadata = self._process_metadata(metadata)
        
        # In testing mode, provide simple embeddings directly
        if os.getenv("TESTING") == "1":
            # Generate a simple embedding for testing
            hash_val = hash(summary)
            embedding = []
            for i in range(384):
                val = ((hash_val + i) % 10000) / 10000.0 - 0.5
                embedding.append(val)
            
            collection.add(
                documents=[summary],
                metadatas=[processed_metadata],
                ids=[conversation_id],
                embeddings=[embedding]
            )
        else:
            collection.add(
                documents=[summary],
                metadatas=[processed_metadata],
                ids=[conversation_id]
            )
        
        logger.info(f"Added conversation summary: {conversation_id}")
    
    def search_similar_conversations(
        self,
        query: str,
        n_results: int = 5,
        metadata_filter: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List]:
        """
        Search for similar conversations using semantic similarity.
        
        Args:
            query: Search query text
            n_results: Number of results to return
            metadata_filter: Optional metadata filter
            
        Returns:
            Dictionary containing ids, documents, metadatas, and distances
        """
        collection = self.get_or_create_collection()
        
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=metadata_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        logger.info(f"Search for '{query}' returned {len(results['ids'][0])} results")
        return results
    
    def update_conversation_summary(
        self,
        conversation_id: str,
        summary: str,
        metadata: Dict[str, Any]
    ) -> None:
        """
        Update an existing conversation summary.
        
        Args:
            conversation_id: Unique identifier for the conversation
            summary: Updated summary text
            metadata: Updated metadata
        """
        collection = self.get_or_create_collection()
        
        # Convert metadata to ChromaDB-compatible format
        processed_metadata = self._process_metadata(metadata)
        
        collection.update(
            ids=[conversation_id],
            documents=[summary],
            metadatas=[processed_metadata]
        )
        
        logger.info(f"Updated conversation summary: {conversation_id}")
    
    def delete_conversation(self, conversation_id: str) -> None:
        """
        Delete a conversation from the vector database.
        
        Args:
            conversation_id: Unique identifier for the conversation
        """
        collection = self.get_or_create_collection()
        
        collection.delete(ids=[conversation_id])
        
        logger.info(f"Deleted conversation: {conversation_id}")
    
    def get_conversation_count(self) -> int:
        """
        Get the total number of conversations in the collection.
        
        Returns:
            Total count of conversations
        """
        collection = self.get_or_create_collection()
        return collection.count()
    
    def get_user_conversations(self, user_id: str) -> Dict[str, List]:
        """
        Get all conversations for a specific user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary containing user's conversations
        """
        collection = self.get_or_create_collection()
        
        results = collection.get(
            where={"user_id": user_id},
            include=["documents", "metadatas"]
        )
        
        logger.info(f"Retrieved {len(results['ids'])} conversations for user: {user_id}")
        return results
    
    def store_conversation_summary(
        self, 
        conversation_id: int, 
        summary: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Store a conversation summary in ChromaDB.
        
        Args:
            conversation_id: ID of the conversation
            summary: Summary text to store
            metadata: Optional metadata about the conversation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            collection = self.get_or_create_collection()
            
            # Convert metadata to ChromaDB-compatible format
            processed_metadata = self._process_metadata(metadata) if metadata else {}
            
            upsert_kwargs = {
                "ids": [str(conversation_id)],
                "documents": [summary]
            }
            
            if processed_metadata:
                upsert_kwargs["metadatas"] = [processed_metadata]
            
            # In testing mode, provide simple embeddings directly to avoid ChromaDB embedding function issues
            if os.getenv("TESTING") == "1":
                # Generate a simple embedding for testing
                hash_val = hash(summary)
                embedding = []
                for i in range(384):
                    val = ((hash_val + i) % 10000) / 10000.0 - 0.5
                    embedding.append(val)
                upsert_kwargs["embeddings"] = [embedding]
            
            collection.upsert(**upsert_kwargs)
            
            return True
        except Exception as e:
            print(f"Error storing conversation summary: {e}")
            return False
    
    async def store_conversation_embedding(
        self, 
        conversation_id: int, 
        summary: str, 
        user_id: int,
        username: str,
        display_name: str,
        title: str,
        created_at: str
    ) -> bool:
        """Store conversation embedding in ChromaDB.
        
        This is the main method for storing conversation summaries as embeddings.
        """
        metadata = {
            "user_id": user_id,
            "username": username,
            "display_name": display_name,
            "title": title,
            "created_at": created_at,
            "conversation_id": conversation_id
        }
        
        return self.store_conversation_summary(conversation_id, summary, metadata)
    
    def semantic_search(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Perform semantic search with pagination.
        
        Args:
            query: Search query text
            limit: Number of results to return (max 20)
            offset: Number of results to skip for pagination
            
        Returns:
            Dictionary with search results and pagination info
        """
        try:
            collection = self.get_or_create_collection()
            
            # ChromaDB doesn't have native offset support, so we need to fetch more
            # and slice. For large datasets, this isn't optimal but works for now.
            fetch_limit = min(limit + offset, 100)  # Cap at 100 for performance
            
            results = collection.query(
                query_texts=[query],
                n_results=fetch_limit,
                include=["documents", "metadatas", "distances"]
            )
            
            # Apply pagination by slicing results
            if results['ids'] and len(results['ids'][0]) > 0:
                start_idx = min(offset, len(results['ids'][0]))
                end_idx = min(offset + limit, len(results['ids'][0]))
                
                paginated_results = {
                    'ids': [results['ids'][0][start_idx:end_idx]],
                    'documents': [results['documents'][0][start_idx:end_idx]],
                    'metadatas': [results['metadatas'][0][start_idx:end_idx]],
                    'distances': [results['distances'][0][start_idx:end_idx]]
                }
                
                return {
                    'results': paginated_results,
                    'total_found': len(results['ids'][0]),
                    'has_more': end_idx < len(results['ids'][0])
                }
            else:
                return {
                    'results': {'ids': [[]], 'documents': [[]], 'metadatas': [[]], 'distances': [[]]},
                    'total_found': 0,
                    'has_more': False
                }
                
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            return {
                'results': {'ids': [[]], 'documents': [[]], 'metadatas': [[]], 'distances': [[]]},
                'total_found': 0,
                'has_more': False
            }
    
    def get_nearest_conversations(self, limit: int = 20) -> Dict[str, Any]:
        """Get the most recent conversations for discovery feed.
        
        Args:
            limit: Number of conversations to return
            
        Returns:
            Dictionary with conversation data
        """
        try:
            collection = self.get_or_create_collection()
            
            # Get all conversations and sort by creation time
            # Note: ChromaDB doesn't have native sorting, so we fetch all and sort
            results = collection.get(
                include=["documents", "metadatas"]
            )
            
            if results['ids']:
                # Sort by created_at timestamp
                conversations_with_time = []
                for i, conv_id in enumerate(results['ids']):
                    metadata = results['metadatas'][i] if results['metadatas'] else {}
                    created_at = metadata.get('created_at', '1970-01-01T00:00:00Z')
                    
                    conversations_with_time.append({
                        'id': conv_id,
                        'document': results['documents'][i] if results['documents'] else "",
                        'metadata': metadata,
                        'created_at': created_at
                    })
                
                # Sort by created_at descending (most recent first)
                conversations_with_time.sort(key=lambda x: x['created_at'], reverse=True)
                
                # Take only the requested limit
                limited_conversations = conversations_with_time[:limit]
                
                # Format results
                formatted_results = {
                    'ids': [conv['id'] for conv in limited_conversations],
                    'documents': [conv['document'] for conv in limited_conversations],
                    'metadatas': [conv['metadata'] for conv in limited_conversations]
                }
                
                return {
                    'results': formatted_results,
                    'total_found': len(limited_conversations)
                }
            else:
                return {
                    'results': {'ids': [], 'documents': [], 'metadatas': []},
                    'total_found': 0
                }
                
        except Exception as e:
            logger.error(f"Error getting nearest conversations: {e}")
            return {
                'results': {'ids': [], 'documents': [], 'metadatas': []},
                'total_found': 0
            }
    
    def find_similar_conversations(self, conversation_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Find conversations similar to the given conversation by its summary.
        
        Args:
            conversation_id: ID of the conversation to find similar ones for
            limit: Maximum number of similar conversations to return
            
        Returns:
            List of similar conversations with similarity scores and metadata
        """
        try:
            collection = self.get_or_create_collection()
            
            # First get the conversation's summary
            results = collection.get(
                ids=[conversation_id],
                include=["documents"]
            )
            
            if not results['ids'] or not results['documents'][0]:
                # No summary found for this conversation
                return []
            
            query_summary = results['documents'][0]
            
            # Search for similar conversations
            similar_results = collection.query(
                query_texts=[query_summary],
                n_results=limit + 1,  # +1 because we'll filter out the query conversation itself
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results and filter out the original conversation
            similar_conversations = []
            for i, conv_id in enumerate(similar_results['ids'][0]):
                if conv_id != conversation_id:  # Don't include the conversation itself
                    metadata = similar_results['metadatas'][0][i] if similar_results['metadatas'] else {}
                    distance = similar_results['distances'][0][i] if similar_results['distances'] else 1.0
                    
                    # Convert distance to similarity score (higher is more similar)
                    similarity_score = max(0.0, 1.0 - distance)
                    
                    similar_conversations.append({
                        'id': int(conv_id),
                        'title': metadata.get('title', 'Untitled'),
                        'summary': similar_results['documents'][0][i] if similar_results['documents'] else '',
                        'similarity_score': similarity_score,
                        'is_public': metadata.get('is_public', 'true') == 'true',
                        'created_at': metadata.get('created_at', ''),
                        'author': {
                            'id': int(metadata.get('user_id', 0)),
                            'username': metadata.get('username', '')
                        }
                    })
            
            # Sort by similarity score (highest first) and limit results
            similar_conversations.sort(key=lambda x: x['similarity_score'], reverse=True)
            return similar_conversations[:limit]
            
        except Exception as e:
            logger.error(f"Error finding similar conversations for {conversation_id}: {e}")
            return []


# Global instance
vector_service = VectorService()