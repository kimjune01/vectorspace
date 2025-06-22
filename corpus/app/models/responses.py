"""API response models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SimilarityResult(BaseModel):
    """Single similarity search result."""
    
    id: str = Field(..., description="Document ID")
    similarity_score: float = Field(..., description="Cosine similarity score")
    title: str = Field(..., description="Post title")
    url: str = Field(..., description="Post URL")
    platform: str = Field(..., description="Source platform")
    timestamp: datetime = Field(..., description="Post creation time")
    summary: str = Field(..., description="Content summary")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (score, comment_count, etc.)"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SimilaritySearchRequest(BaseModel):
    """Similarity search request."""
    
    embedding: List[float] = Field(..., description="Query embedding vector")
    collections: List[str] = Field(
        default=["hackernews"], 
        description="Collections to search"
    )
    limit: int = Field(default=10, ge=1, le=100, description="Max results")
    min_similarity: float = Field(
        default=0.7, 
        ge=0.0, 
        le=1.0, 
        description="Minimum similarity threshold"
    )
    time_window_days: Optional[int] = Field(
        default=30,
        ge=1,
        description="Only include posts from last N days"
    )


class SimilaritySearchResponse(BaseModel):
    """Similarity search response."""
    
    results: List[SimilarityResult] = Field(..., description="Search results")
    total_searched: int = Field(..., description="Total documents searched")
    search_time_ms: int = Field(..., description="Search execution time")
    query_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Query execution metadata"
    )


class CollectionStats(BaseModel):
    """ChromaDB collection statistics."""
    
    name: str = Field(..., description="Collection name")
    document_count: int = Field(..., description="Number of documents")
    last_updated: Optional[datetime] = Field(None, description="Last update time")
    size_bytes: Optional[int] = Field(None, description="Collection size")
    sample_documents: List[str] = Field(
        default_factory=list,
        description="Sample document IDs"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HealthCheckResponse(BaseModel):
    """Service health check response."""
    
    status: str = Field(..., description="Service status (healthy/unhealthy)")
    uptime_seconds: int = Field(..., description="Service uptime")
    collections: Dict[str, CollectionStats] = Field(
        default_factory=dict,
        description="Collection health status"
    )
    scraper: Dict[str, Any] = Field(
        default_factory=dict,
        description="Scraper status and metrics"
    )
    version: str = Field(default="0.1.0", description="Service version")


class ScraperStatus(BaseModel):
    """Background scraper status."""
    
    status: str = Field(..., description="Current status (idle/running/error)")
    last_run: Optional[datetime] = Field(None, description="Last successful run")
    next_run: Optional[datetime] = Field(None, description="Next scheduled run")
    posts_processed: int = Field(default=0, description="Posts processed this session")
    errors: List[str] = Field(default_factory=list, description="Recent errors")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ErrorResponse(BaseModel):
    """API error response."""
    
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Error category")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None, description="Request tracking ID")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }