"""Similarity search API endpoints."""

import logging
import time
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from ..models.responses import (
    SimilaritySearchRequest, 
    SimilaritySearchResponse,
    ErrorResponse
)
from ..services.vector_db import VectorDBService
from ..dependencies import get_vector_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/similarity", tags=["similarity"])


@router.post("/search", response_model=SimilaritySearchResponse)
async def search_similar_posts(
    request: SimilaritySearchRequest,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> SimilaritySearchResponse:
    """
    Search for semantically similar posts across collections.
    
    This endpoint accepts an embedding vector and returns the most similar posts
    from the specified collections, ranked by cosine similarity.
    """
    start_time = time.time()
    
    try:
        # Validate collections exist
        available_collections = vector_db.list_collections()
        invalid_collections = [
            col for col in request.collections 
            if col not in available_collections
        ]
        
        if invalid_collections:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid collections: {invalid_collections}. "
                      f"Available: {available_collections}"
            )
        
        # Perform similarity search
        results = await vector_db.search_similar(
            query_embedding=request.embedding,
            collection_names=request.collections,
            limit=request.limit,
            min_similarity=request.min_similarity,
            time_window_days=request.time_window_days
        )
        
        # Calculate total documents searched (approximate)
        total_searched = 0
        for collection_name in request.collections:
            stats = await vector_db.get_collection_stats(collection_name)
            if stats:
                total_searched += stats.document_count
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return SimilaritySearchResponse(
            results=results,
            total_searched=total_searched,
            search_time_ms=search_time_ms,
            query_metadata={
                "collections_searched": request.collections,
                "min_similarity_threshold": request.min_similarity,
                "time_window_days": request.time_window_days,
                "embedding_dimensions": len(request.embedding)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similarity search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/collections", response_model=List[str])
async def list_available_collections(
    vector_db: VectorDBService = Depends(get_vector_db)
) -> List[str]:
    """List all available collections for searching."""
    try:
        return vector_db.list_collections()
    except Exception as e:
        logger.error(f"Failed to list collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list collections: {str(e)}"
        )


@router.post("/search/text")
async def search_by_text(
    query: str,
    collections: List[str] = None,
    limit: int = 10,
    min_similarity: float = 0.7,
    time_window_days: int = None,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> SimilaritySearchResponse:
    """
    Search using text query (automatically generates embedding).
    
    This is a convenience endpoint that generates embeddings from text
    and then performs similarity search.
    """
    try:
        # Generate embedding for the text query
        # Note: This requires the embedding function to be accessible
        # For now, we'll return an error suggesting direct embedding usage
        raise HTTPException(
            status_code=501,
            detail="Text search not implemented. Please generate embeddings "
                  "externally and use /search endpoint directly."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text search failed: {str(e)}"
        )