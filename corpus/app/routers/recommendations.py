"""Hacker News recommendations API endpoints."""

import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..models.post import ProcessedPost
from ..services.vector_db import VectorDBService
from ..dependencies import get_vector_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["recommendations"])


class HNRecommendationsRequest(BaseModel):
    """Request model for HN recommendations."""
    summary: str


class HNRecommendationsResponse(BaseModel):
    """Response model for HN recommendations."""
    recommendations: List[Dict[str, Any]]


@router.post("/hn-recommendations", response_model=HNRecommendationsResponse)
async def get_hn_recommendations(
    request: HNRecommendationsRequest,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> HNRecommendationsResponse:
    """
    Get Hacker News recommendations based on a text summary.
    
    This endpoint:
    1. Generates embeddings for the provided summary using ChromaDB
    2. Searches for similar HN posts in the vector database
    3. Applies relevance × recency scoring
    4. Returns top recommendations
    """
    try:
        # Validate input
        if not request.summary or not request.summary.strip():
            return HNRecommendationsResponse(recommendations=[])
        
        # Generate embedding for the summary using ChromaDB's embedding function
        embedding = vector_db.embedding_function([request.summary.strip()])[0]
        
        # Search for similar HN posts
        results = await vector_db.search_similar(
            query_embedding=embedding,
            collection_names=["hackernews"],
            limit=20,  # Get more results for relevance × recency scoring
            min_similarity=0.6,  # Lower threshold to get more candidates
            time_window_days=30  # Look at posts from last 30 days
        )
        
        # Convert results to recommendation format with relevance × recency scoring
        recommendations = []
        now = datetime.now(timezone.utc)
        
        for result in results:
            try:
                # Extract metadata
                metadata = result.metadata
                
                # Parse timestamp
                timestamp_str = metadata.get("timestamp", "")
                if timestamp_str:
                    post_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    # Fallback to current time if timestamp missing
                    post_time = now
                
                # Calculate recency score (exponential decay with 24h half-life)
                time_diff_hours = (now - post_time).total_seconds() / 3600
                recency_score = 2 ** (-time_diff_hours / 24)
                
                # Combined score: similarity × recency
                combined_score = result.similarity * recency_score
                
                # Build recommendation
                recommendation = {
                    "title": metadata.get("title", "Untitled"),
                    "url": metadata.get("original_url", metadata.get("url", "")),
                    "score": combined_score,
                    "timestamp": timestamp_str or now.isoformat()
                }
                
                recommendations.append(recommendation)
                
            except Exception as e:
                logger.warning(f"Failed to process result: {e}")
                continue
        
        # Sort by combined score and take top 5
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        top_recommendations = recommendations[:5]
        
        return HNRecommendationsResponse(recommendations=top_recommendations)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get HN recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get recommendations: {str(e)}"
        )