"""Corpus service integration router."""

import httpx
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
from app.auth import get_current_user
from app.models import User
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Corpus service configuration
CORPUS_SERVICE_URL = os.getenv("CORPUS_SERVICE_URL", "http://localhost:8001")
CORPUS_REQUEST_TIMEOUT = int(os.getenv("CORPUS_REQUEST_TIMEOUT", "30"))

class CorpusError(Exception):
    """Custom exception for corpus service errors."""
    def __init__(self, message: str, status_code: int, details: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class SimilaritySearchRequest(BaseModel):
    """Request model for similarity search."""
    query_texts: List[str]
    collections: List[str] = ["hackernews"]
    limit: int = 5
    min_similarity: float = 0.75

class CorpusHealthResponse(BaseModel):
    """Response model for corpus health check."""
    status: str
    corpus_service: str
    collections: Dict[str, Any]
    error: Optional[str] = None

async def check_corpus_service() -> Dict[str, Any]:
    """
    Check if corpus service is available and healthy.
    
    Returns:
        Dict containing health status and debug information
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{CORPUS_SERVICE_URL}/health")
            
            if response.status_code == 200:
                corpus_health = response.json()
                return {
                    "status": "healthy",
                    "corpus_service": "connected",
                    "response": corpus_health,
                    "url": CORPUS_SERVICE_URL
                }
            else:
                return {
                    "status": "unhealthy",
                    "corpus_service": "error",
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "url": CORPUS_SERVICE_URL
                }
                
    except httpx.ConnectError:
        return {
            "status": "unhealthy",
            "corpus_service": "disconnected",
            "error": f"Cannot connect to corpus service at {CORPUS_SERVICE_URL}",
            "url": CORPUS_SERVICE_URL,
            "suggestion": "Ensure corpus service is running: cd corpus && uv run python main.py"
        }
    except httpx.TimeoutException:
        return {
            "status": "unhealthy",
            "corpus_service": "timeout",
            "error": f"Corpus service timeout after 5 seconds",
            "url": CORPUS_SERVICE_URL
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "corpus_service": "error",
            "error": f"Unexpected error: {str(e)}",
            "url": CORPUS_SERVICE_URL
        }

async def proxy_corpus_request(
    endpoint: str,
    method: str = "GET",
    json_data: Optional[Dict] = None,
    params: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Proxy request to corpus service with comprehensive error handling.
    
    Args:
        endpoint: API endpoint path (e.g., "/api/v1/similarity/search")
        method: HTTP method
        json_data: JSON body for POST requests
        params: Query parameters
        
    Returns:
        Response data from corpus service
        
    Raises:
        CorpusError: When corpus service request fails
    """
    url = f"{CORPUS_SERVICE_URL}{endpoint}"
    
    try:
        async with httpx.AsyncClient(timeout=CORPUS_REQUEST_TIMEOUT) as client:
            logger.info(f"Corpus request: {method} {url}")
            
            if method.upper() == "POST":
                response = await client.post(url, json=json_data, params=params)
            else:
                response = await client.get(url, params=params)
            
            logger.info(f"Corpus response: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise CorpusError(
                    f"Corpus endpoint not found: {endpoint}",
                    404,
                    {
                        "url": url,
                        "available_endpoints": [
                            "/api/v1/similarity/search",
                            "/api/v1/similarity/collections",
                            "/api/v1/admin/collections",
                            "/health"
                        ]
                    }
                )
            elif response.status_code == 422:
                error_detail = response.json()
                raise CorpusError(
                    "Invalid request format for corpus service",
                    422,
                    {
                        "validation_errors": error_detail,
                        "example_request": {
                            "query_texts": ["artificial intelligence"],
                            "collections": ["hackernews"],
                            "limit": 5
                        }
                    }
                )
            else:
                raise CorpusError(
                    f"Corpus service error: HTTP {response.status_code}",
                    response.status_code,
                    {"response": response.text, "url": url}
                )
                
    except httpx.ConnectError:
        raise CorpusError(
            "Cannot connect to corpus service",
            503,
            {
                "url": url,
                "corpus_service_url": CORPUS_SERVICE_URL,
                "troubleshooting": {
                    "check_service": f"curl {CORPUS_SERVICE_URL}/health",
                    "start_service": "cd corpus && uv run python main.py",
                    "check_port": "lsof -ti:8001"
                }
            }
        )
    except httpx.TimeoutException:
        raise CorpusError(
            f"Corpus service timeout after {CORPUS_REQUEST_TIMEOUT} seconds",
            504,
            {
                "url": url,
                "timeout": CORPUS_REQUEST_TIMEOUT,
                "suggestion": "Corpus service may be overloaded or processing large datasets"
            }
        )
    except Exception as e:
        raise CorpusError(
            f"Unexpected corpus service error: {str(e)}",
            500,
            {"url": url, "exception_type": type(e).__name__}
        )

@router.get("/health", response_model=CorpusHealthResponse)
async def corpus_health():
    """Check corpus service health and availability."""
    health_data = await check_corpus_service()
    
    if health_data["status"] == "healthy":
        # Try to get collections info
        try:
            collections_data = await proxy_corpus_request("/api/v1/similarity/collections")
            detailed_health = await proxy_corpus_request("/api/v1/debug/health")
            
            return CorpusHealthResponse(
                status="healthy",
                corpus_service="connected",
                collections=detailed_health.get("collections", {})
            )
        except CorpusError as e:
            return CorpusHealthResponse(
                status="degraded",
                corpus_service="connected",
                collections={},
                error=f"Service connected but API error: {e.message}"
            )
    else:
        return CorpusHealthResponse(
            status="unhealthy",
            corpus_service="disconnected",
            collections={},
            error=health_data.get("error", "Unknown error")
        )

@router.get("/collections")
async def get_corpus_collections(current_user: User = Depends(get_current_user)):
    """Get available corpus collections."""
    try:
        collections = await proxy_corpus_request("/api/v1/similarity/collections")
        return {
            "collections": collections,
            "debug": {
                "user_id": current_user.id,
                "corpus_url": CORPUS_SERVICE_URL
            }
        }
    except CorpusError as e:
        logger.error(f"Failed to get corpus collections: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "type": "corpus_service_error",
                "debug": e.details
            }
        )

@router.post("/similarity/search")
async def search_similar_content(
    request: SimilaritySearchRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Search for similar content in corpus collections using conversation summary.
    
    This endpoint converts the query texts to embeddings and searches for semantically
    similar external content from platforms like Hacker News.
    """
    try:
        # Prepare request for corpus service
        search_request = {
            "query_texts": request.query_texts,
            "collections": request.collections,
            "limit": request.limit,
            "min_similarity": request.min_similarity
        }
        
        logger.info(f"Corpus similarity search for user {current_user.id}: {request.query_texts}")
        
        # Use the first query text as the main query
        query_text = request.query_texts[0] if request.query_texts else ""
        if not query_text:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Query text is required",
                    "type": "validation_error"
                }
            )
        
        # Generate embedding for the query text
        try:
            embedding = await ai_service.generate_embedding(query_text)
            logger.info(f"Generated embedding with {len(embedding)} dimensions")
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"Failed to generate embedding: {str(e)}",
                    "type": "embedding_error",
                    "debug": {
                        "query_text": query_text,
                        "embedding_service": "openai"
                    }
                }
            )
        
        # Prepare search request for corpus service
        corpus_search_request = {
            "embedding": embedding,
            "collections": request.collections,
            "limit": request.limit,
            "min_similarity": request.min_similarity
        }
        
        # Make request to corpus service using embedding search endpoint
        results = await proxy_corpus_request(
            "/api/v1/similarity/search",
            method="POST",
            json_data=corpus_search_request
        )
        
        return {
            "results": results.get("results", []),
            "query": request.query_texts,
            "collections_searched": request.collections,
            "total_found": len(results.get("results", [])),
            "debug": {
                "user_id": current_user.id,
                "corpus_url": CORPUS_SERVICE_URL,
                "search_params": search_request
            }
        }
        
    except CorpusError as e:
        logger.error(f"Corpus similarity search failed: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "type": "corpus_search_error",
                "query": request.query_texts,
                "debug": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in corpus search: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error during corpus search",
                "type": "internal_error",
                "debug": {
                    "exception": str(e),
                    "user_id": current_user.id
                }
            }
        )

@router.get("/collections/{collection_name}/stats")
async def get_collection_stats(
    collection_name: str,
    current_user: User = Depends(get_current_user)
):
    """Get statistics for a specific corpus collection."""
    try:
        stats = await proxy_corpus_request(f"/api/v1/admin/collections/{collection_name}/stats")
        return {
            "collection": collection_name,
            "stats": stats,
            "debug": {
                "user_id": current_user.id,
                "corpus_url": CORPUS_SERVICE_URL
            }
        }
    except CorpusError as e:
        logger.error(f"Failed to get collection stats for {collection_name}: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "type": "corpus_stats_error",
                "collection": collection_name,
                "debug": e.details
            }
        )

@router.get("/hn-topics")
async def get_hn_trending_topics(
    current_conversation_summary: str,
    limit: int = 5,
    current_user: User = Depends(get_current_user)
):
    """
    Get semantically similar topics from Hacker News content based on conversation summary.
    
    Requires current_conversation_summary to find HN topics semantically similar to the conversation.
    This ensures only relevant topics are shown after a conversation has been summarized.
    """
    try:
        # Validate that conversation summary is provided and not empty
        if not current_conversation_summary or not current_conversation_summary.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Conversation summary is required for HN topic discovery",
                    "type": "validation_error",
                    "message": "This endpoint only shows HN topics when a conversation has been summarized"
                }
            )
        
        # Find HN content similar to current conversation
        search_request = {
            "query_texts": [current_conversation_summary],
            "collections": ["hackernews"],
            "limit": limit * 2,  # Get more results to extract diverse topics
            "min_similarity": 0.6  # Lower threshold for broader topic discovery
        }
        
        # Generate embedding for the conversation summary
        try:
            embedding = await ai_service.generate_embedding(current_conversation_summary)
        except Exception as e:
            logger.error(f"Failed to generate embedding for conversation: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to generate embedding for conversation summary",
                    "type": "embedding_error",
                    "debug": {"exception": str(e)}
                }
            )
        
        # Search for similar HN content
        corpus_search_request = {
            "embedding": embedding,
            "collections": ["hackernews"],
            "limit": limit * 2,
            "min_similarity": 0.6
        }
        
        results = await proxy_corpus_request(
            "/api/v1/similarity/search",
            method="POST",
            json_data=corpus_search_request
        )
        
        # Extract topics from HN titles and summaries
        topics = _extract_topics_from_hn_results(results.get("results", []), limit)
        
        return {
            "topics": topics,
            "source": "hackernews",
            "context": "semantic_similarity",
            "debug": {
                "user_id": current_user.id,
                "conversation_summary_length": len(current_conversation_summary),
                "topics_count": len(topics)
            }
        }
        
    except CorpusError as e:
        logger.error(f"Failed to get HN topics: {e.message}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Corpus service unavailable for HN topic discovery",
                "type": "corpus_service_error",
                "message": "Unable to find semantically similar HN topics at this time",
                "debug": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error getting HN topics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to retrieve HN topics",
                "type": "internal_error",
                "debug": {"exception": str(e)}
            }
        )


def _extract_topics_from_hn_results(results: List[Dict], limit: int) -> List[str]:
    """Extract topic keywords from HN search results."""
    topics = set()
    
    for result in results:
        metadata = result.get("metadata", {})
        title = metadata.get("title", "")
        summary = result.get("document", "")
        
        # Extract keywords from titles (HN titles are usually descriptive)
        title_words = title.split()
        
        # Look for key technology/topic terms
        tech_terms = []
        for word in title_words:
            word_clean = word.strip(".,!?:;()[]{}").lower()
            if len(word_clean) > 3 and not word_clean in ["with", "from", "that", "this", "have", "been", "will", "would", "could", "should"]:
                # Capitalize first letter for display
                tech_terms.append(word_clean.capitalize())
        
        # Add meaningful terms
        for term in tech_terms[:2]:  # Take first 2 meaningful terms per result
            topics.add(term)
            if len(topics) >= limit * 2:  # Collect more than needed for variety
                break
        
        if len(topics) >= limit * 2:
            break
    
    # Convert to list and return limited number
    topic_list = list(topics)
    
    # If we don't have enough topics, add some common HN categories
    if len(topic_list) < limit:
        common_topics = ["Artificial Intelligence", "Startups", "Programming", "Technology", "Software"]
        for topic in common_topics:
            if topic not in topic_list:
                topic_list.append(topic)
                if len(topic_list) >= limit:
                    break
    
    return topic_list[:limit]

@router.get("/debug/status")
async def corpus_debug_status(current_user: User = Depends(get_current_user)):
    """Get comprehensive debug information about corpus service integration."""
    try:
        # Get corpus service health
        health = await check_corpus_service()
        
        # Try to get additional debug info if service is available
        debug_info = {
            "corpus_health": health,
            "integration_config": {
                "corpus_service_url": CORPUS_SERVICE_URL,
                "request_timeout": CORPUS_REQUEST_TIMEOUT,
                "current_user": current_user.username
            }
        }
        
        if health["status"] == "healthy":
            try:
                collections = await proxy_corpus_request("/api/v1/similarity/collections")
                corpus_debug = await proxy_corpus_request("/api/v1/debug/health")
                
                debug_info.update({
                    "collections": collections,
                    "corpus_debug": corpus_debug
                })
            except CorpusError as e:
                debug_info["corpus_api_error"] = {
                    "error": e.message,
                    "details": e.details
                }
        
        return debug_info
        
    except Exception as e:
        return {
            "error": f"Failed to get debug status: {str(e)}",
            "corpus_service_url": CORPUS_SERVICE_URL,
            "user": current_user.username
        }