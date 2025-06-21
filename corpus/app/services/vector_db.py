"""ChromaDB vector storage and search interface."""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

from ..models.post import ProcessedPost
from ..models.responses import CollectionStats, SimilarityResult

logger = logging.getLogger(__name__)


class VectorDBService:
    """ChromaDB service for storing and searching post embeddings."""
    
    def __init__(
        self,
        persist_directory: str = "./chroma_db",
        openai_api_key: Optional[str] = None,
        embedding_model: str = "text-embedding-3-small"
    ):
        self.persist_directory = persist_directory
        self.embedding_model = embedding_model
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                is_persistent=True
            )
        )
        
        # Set up OpenAI embedding function
        if openai_api_key:
            self.embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                api_key=openai_api_key,
                model_name=embedding_model
            )
        else:
            logger.warning("No OpenAI API key provided, using default embeddings")
            self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
        
        # Cache for collections
        self._collections: Dict[str, Any] = {}
    
    def _get_collection(self, collection_name: str):
        """Get or create a ChromaDB collection."""
        if collection_name not in self._collections:
            try:
                collection = self.client.get_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function
                )
                logger.info(f"Loaded existing collection: {collection_name}")
            except Exception:
                # Collection doesn't exist, create it
                collection = self.client.create_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function,
                    metadata={"created_at": datetime.utcnow().isoformat()}
                )
                logger.info(f"Created new collection: {collection_name}")
            
            self._collections[collection_name] = collection
        
        return self._collections[collection_name]
    
    def _post_to_chroma_document(self, post: ProcessedPost) -> tuple[str, str, dict]:
        """
        Convert ProcessedPost to ChromaDB document format.
        
        Returns:
            Tuple of (id, content, metadata)
        """
        metadata = {
            "title": post.title,
            "url": post.url,
            "platform": post.platform,
            "timestamp": post.timestamp.isoformat(),
            "author": post.author or "unknown",
            "score": post.score or 0,
            "comment_count": post.comment_count or 0,
            **post.platform_specific
        }
        
        # Add original URL if different from platform URL
        if post.original_url and post.original_url != post.url:
            metadata["original_url"] = post.original_url
        
        return post.id, post.content, metadata
    
    def _chroma_to_similarity_result(
        self,
        doc_id: str,
        document: str,
        metadata: dict,
        distance: float
    ) -> SimilarityResult:
        """Convert ChromaDB result to SimilarityResult."""
        # ChromaDB returns cosine distance, convert to similarity
        similarity_score = 1.0 - distance
        
        # Parse timestamp
        timestamp_str = metadata.get("timestamp", datetime.utcnow().isoformat())
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except Exception:
            timestamp = datetime.utcnow()
        
        # Extract core metadata
        result_metadata = {
            "score": metadata.get("score", 0),
            "comment_count": metadata.get("comment_count", 0),
            "author": metadata.get("author", "unknown")
        }
        
        # Add platform-specific metadata
        for key, value in metadata.items():
            if key.startswith(metadata.get("platform", "") + "_"):
                result_metadata[key] = value
        
        return SimilarityResult(
            id=doc_id,
            similarity_score=similarity_score,
            title=metadata.get("title", ""),
            url=metadata.get("url", ""),
            platform=metadata.get("platform", "unknown"),
            timestamp=timestamp,
            summary=document[:500] + "..." if len(document) > 500 else document,
            metadata=result_metadata
        )
    
    async def add_posts(
        self,
        posts: List[ProcessedPost],
        collection_name: str = "hackernews"
    ) -> int:
        """
        Add posts to the vector database.
        
        Args:
            posts: List of processed posts to add
            collection_name: Target collection name
            
        Returns:
            Number of posts successfully added
        """
        if not posts:
            return 0
        
        collection = self._get_collection(collection_name)
        
        # Convert posts to ChromaDB format
        ids = []
        documents = []
        metadatas = []
        
        for post in posts:
            doc_id, content, metadata = self._post_to_chroma_document(post)
            ids.append(doc_id)
            documents.append(content)
            metadatas.append(metadata)
        
        try:
            # Use upsert to handle duplicates
            collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            
            logger.info(f"Added {len(posts)} posts to collection '{collection_name}'")
            return len(posts)
            
        except Exception as e:
            logger.error(f"Failed to add posts to collection '{collection_name}': {e}")
            return 0
    
    async def search_similar(
        self,
        query_embedding: List[float],
        collection_names: List[str] = None,
        limit: int = 10,
        min_similarity: float = 0.7,
        time_window_days: Optional[int] = None
    ) -> List[SimilarityResult]:
        """
        Search for similar posts across collections.
        
        Args:
            query_embedding: Query vector
            collection_names: Collections to search (default: all)
            limit: Maximum results per collection
            min_similarity: Minimum similarity threshold
            time_window_days: Only include recent posts
            
        Returns:
            List of similarity results, sorted by similarity
        """
        if collection_names is None:
            collection_names = self.list_collections()
        
        all_results = []
        
        for collection_name in collection_names:
            try:
                collection = self._get_collection(collection_name)
                
                # Build where clause for time filtering
                where_clause = None
                if time_window_days:
                    cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
                    where_clause = {
                        "timestamp": {"$gte": cutoff_date.isoformat()}
                    }
                
                # Perform similarity search
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where=where_clause,
                    include=["documents", "metadatas", "distances"]
                )
                
                # Convert results
                for i in range(len(results["ids"][0])):
                    doc_id = results["ids"][0][i]
                    document = results["documents"][0][i]
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]
                    
                    similarity_result = self._chroma_to_similarity_result(
                        doc_id, document, metadata, distance
                    )
                    
                    # Apply similarity threshold
                    if similarity_result.similarity_score >= min_similarity:
                        all_results.append(similarity_result)
                
            except Exception as e:
                logger.error(f"Search failed for collection '{collection_name}': {e}")
        
        # Sort by similarity score and return top results
        all_results.sort(key=lambda x: x.similarity_score, reverse=True)
        return all_results[:limit]
    
    async def get_post(
        self,
        post_id: str,
        collection_name: str = "hackernews"
    ) -> Optional[SimilarityResult]:
        """
        Get a specific post by ID.
        
        Args:
            post_id: Post identifier
            collection_name: Collection to search
            
        Returns:
            SimilarityResult or None if not found
        """
        try:
            collection = self._get_collection(collection_name)
            
            results = collection.get(
                ids=[post_id],
                include=["documents", "metadatas"]
            )
            
            if results["ids"] and results["ids"][0]:
                doc_id = results["ids"][0]
                document = results["documents"][0]
                metadata = results["metadatas"][0]
                
                return self._chroma_to_similarity_result(
                    doc_id, document, metadata, 0.0  # Distance 0 for exact match
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get post '{post_id}' from '{collection_name}': {e}")
            return None
    
    def list_collections(self) -> List[str]:
        """List all available collections."""
        try:
            collections = self.client.list_collections()
            return [col.name for col in collections]
        except Exception as e:
            logger.error(f"Failed to list collections: {e}")
            return []
    
    async def get_collection_stats(self, collection_name: str) -> Optional[CollectionStats]:
        """Get statistics for a collection."""
        try:
            collection = self._get_collection(collection_name)
            
            # Get collection count
            count_result = collection.count()
            
            # Get sample documents
            sample_results = collection.peek(limit=5)
            sample_ids = sample_results.get("ids", [])
            
            # Try to get collection metadata
            collection_metadata = getattr(collection, "metadata", {}) or {}
            created_at_str = collection_metadata.get("created_at")
            last_updated = None
            if created_at_str:
                try:
                    last_updated = datetime.fromisoformat(created_at_str)
                except Exception:
                    pass
            
            return CollectionStats(
                name=collection_name,
                document_count=count_result,
                last_updated=last_updated,
                sample_documents=sample_ids
            )
            
        except Exception as e:
            logger.error(f"Failed to get stats for collection '{collection_name}': {e}")
            return None
    
    async def delete_collection(self, collection_name: str) -> bool:
        """Delete a collection."""
        try:
            self.client.delete_collection(name=collection_name)
            
            # Remove from cache
            if collection_name in self._collections:
                del self._collections[collection_name]
            
            logger.info(f"Deleted collection: {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete collection '{collection_name}': {e}")
            return False
    
    async def health_check(self) -> bool:
        """Check if ChromaDB is accessible."""
        try:
            # Try to list collections as a health check
            self.client.list_collections()
            return True
        except Exception as e:
            logger.error(f"ChromaDB health check failed: {e}")
            return False