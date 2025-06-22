"""Post data models for external content."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HackerNewsPost(BaseModel):
    """Raw Hacker News post from API."""
    
    id: int
    title: Optional[str] = None
    text: Optional[str] = None
    url: Optional[str] = None
    score: Optional[int] = None
    descendants: Optional[int] = None  # Comment count
    time: Optional[int] = None  # Unix timestamp
    by: Optional[str] = None  # Author username
    kids: Optional[List[int]] = None  # Child comment IDs
    type: Optional[str] = None  # "story", "comment", etc.


class HackerNewsComment(BaseModel):
    """Raw Hacker News comment from API."""
    
    id: int
    text: Optional[str] = None
    time: Optional[int] = None
    by: Optional[str] = None
    parent: Optional[int] = None
    kids: Optional[List[int]] = None
    type: Optional[str] = None


class ProcessedPost(BaseModel):
    """Processed post ready for ChromaDB storage."""
    
    id: str = Field(..., description="Platform-specific ID (e.g., 'hn_12345678')")
    content: str = Field(..., description="AI-summarized content (~500 tokens)")
    title: str = Field(..., description="Original post title")
    url: str = Field(..., description="Platform URL")
    original_url: Optional[str] = Field(None, description="External link URL")
    platform: str = Field(..., description="Source platform")
    author: Optional[str] = Field(None, description="Post author")
    timestamp: datetime = Field(..., description="Post creation time")
    score: Optional[int] = Field(None, description="Post score/upvotes")
    comment_count: Optional[int] = Field(None, description="Number of comments")
    platform_specific: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Platform-specific metadata"
    )
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SummaryRequest(BaseModel):
    """Request for AI summarization."""
    
    title: str
    content: str
    comments: List[str] = Field(default_factory=list)
    max_tokens: int = Field(default=500, description="Target summary length")


class SummaryResponse(BaseModel):
    """AI summarization response."""
    
    summary: str = Field(..., description="Condensed content summary")
    token_count: int = Field(..., description="Estimated token count")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")


# Alias for backward compatibility
Post = ProcessedPost