"""Abstract base class for platform scrapers."""

from abc import ABC, abstractmethod
from typing import List, Optional
from ..models.post import ProcessedPost


class BaseScraper(ABC):
    """Abstract base class for platform-specific scrapers."""
    
    def __init__(self, rate_limit_per_second: float = 1.0):
        self.rate_limit_per_second = rate_limit_per_second
        self.platform_name = self._get_platform_name()
    
    @abstractmethod
    def _get_platform_name(self) -> str:
        """Return the platform name (e.g., 'hackernews', 'reddit')."""
        pass
    
    @abstractmethod
    async def fetch_top_posts(
        self, 
        limit: int = 100,
        min_score: Optional[int] = None
    ) -> List[ProcessedPost]:
        """
        Fetch top posts from the platform.
        
        Args:
            limit: Maximum number of posts to fetch
            min_score: Minimum score/upvotes required
            
        Returns:
            List of processed posts ready for storage
        """
        pass
    
    @abstractmethod
    async def fetch_post_details(self, post_id: str) -> Optional[ProcessedPost]:
        """
        Fetch detailed information for a specific post.
        
        Args:
            post_id: Platform-specific post identifier
            
        Returns:
            Processed post or None if not found
        """
        pass
    
    @abstractmethod 
    async def health_check(self) -> bool:
        """
        Check if the platform API is accessible.
        
        Returns:
            True if platform is accessible, False otherwise
        """
        pass