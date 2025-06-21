"""Hacker News scraper implementation."""

import asyncio
import logging
from datetime import datetime
from typing import List, Optional
import httpx
from aiolimiter import AsyncLimiter

from ..models.post import HackerNewsPost, HackerNewsComment, ProcessedPost
from ..services.summarizer import SummarizerService
from .base import BaseScraper

logger = logging.getLogger(__name__)


class HackerNewsScraper(BaseScraper):
    """Hacker News API scraper with rate limiting and summarization."""
    
    def __init__(
        self,
        api_base_url: str = "https://hacker-news.firebaseio.com/v0",
        rate_limit_per_second: float = 1.0,
        summarizer: Optional[SummarizerService] = None
    ):
        super().__init__(rate_limit_per_second)
        self.api_base_url = api_base_url
        self.rate_limiter = AsyncLimiter(rate_limit_per_second, 1)
        self.summarizer = summarizer
        self.session: Optional[httpx.AsyncClient] = None
    
    def _get_platform_name(self) -> str:
        return "hackernews"
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = httpx.AsyncClient(timeout=30.0)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.aclose()
    
    async def _make_request(self, url: str) -> Optional[dict]:
        """Make rate-limited API request."""
        if not self.session:
            raise RuntimeError("Scraper not initialized. Use async context manager.")
        
        async with self.rate_limiter:
            try:
                response = await self.session.get(url)
                response.raise_for_status()
                return response.json()
            except httpx.RequestError as e:
                logger.error(f"Request failed for {url}: {e}")
                return None
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error for {url}: {e.response.status_code}")
                return None
    
    async def fetch_top_stories(self) -> List[int]:
        """Fetch current top story IDs from HN."""
        url = f"{self.api_base_url}/topstories.json"
        story_ids = await self._make_request(url)
        return story_ids if story_ids else []
    
    async def fetch_item(self, item_id: int) -> Optional[dict]:
        """Fetch individual item (story/comment) by ID."""
        url = f"{self.api_base_url}/item/{item_id}.json"
        return await self._make_request(url)
    
    async def fetch_story_with_comments(
        self, 
        story_id: int, 
        max_comments: int = 10
    ) -> tuple[Optional[HackerNewsPost], List[HackerNewsComment]]:
        """
        Fetch story and its top comments.
        
        Args:
            story_id: HN story ID
            max_comments: Maximum number of comments to fetch
            
        Returns:
            Tuple of (story, comments)
        """
        # Fetch the main story
        story_data = await self.fetch_item(story_id)
        if not story_data:
            return None, []
        
        try:
            story = HackerNewsPost(**story_data)
        except Exception as e:
            logger.error(f"Failed to parse story {story_id}: {e}")
            return None, []
        
        # Fetch comments if they exist
        comments = []
        if story.kids and max_comments > 0:
            comment_tasks = [
                self.fetch_item(comment_id) 
                for comment_id in story.kids[:max_comments]
            ]
            
            comment_results = await asyncio.gather(*comment_tasks, return_exceptions=True)
            
            for comment_data in comment_results:
                if isinstance(comment_data, dict) and comment_data:
                    try:
                        comment = HackerNewsComment(**comment_data)
                        if comment.text:  # Only include comments with text
                            comments.append(comment)
                    except Exception as e:
                        logger.warning(f"Failed to parse comment: {e}")
        
        return story, comments
    
    async def process_story(
        self, 
        story: HackerNewsPost, 
        comments: List[HackerNewsComment]
    ) -> Optional[ProcessedPost]:
        """
        Process a story and its comments into a ProcessedPost.
        
        Args:
            story: Raw HN story data
            comments: List of comments
            
        Returns:
            ProcessedPost ready for ChromaDB storage
        """
        if not story.title:
            return None
        
        # Prepare content for summarization
        content_parts = []
        
        # Add story text if available
        if story.text:
            content_parts.append(f"Story: {story.text}")
        
        # Add top comments
        for comment in comments[:5]:  # Limit to top 5 comments
            if comment.text:
                content_parts.append(f"Comment: {comment.text}")
        
        # Generate summary if summarizer is available
        content = "\n\n".join(content_parts)
        if self.summarizer and content:
            try:
                summary_response = await self.summarizer.summarize(
                    title=story.title,
                    content=content,
                    max_tokens=500
                )
                summarized_content = summary_response.summary
            except Exception as e:
                logger.error(f"Summarization failed for story {story.id}: {e}")
                # Fallback to truncated content
                summarized_content = content[:2000] if content else story.title
        else:
            # Use title + truncated content as fallback
            summarized_content = content[:2000] if content else story.title
        
        # Build processed post
        try:
            processed_post = ProcessedPost(
                id=f"hn_{story.id}",
                content=summarized_content,
                title=story.title,
                url=f"https://news.ycombinator.com/item?id={story.id}",
                original_url=story.url,
                platform=self.platform_name,
                author=story.by,
                timestamp=datetime.fromtimestamp(story.time) if story.time else datetime.utcnow(),
                score=story.score,
                comment_count=story.descendants,
                platform_specific={
                    "hn_type": story.type,
                    "hn_kids_count": len(story.kids) if story.kids else 0,
                    "has_external_url": bool(story.url),
                    "comment_preview_count": len(comments)
                }
            )
            return processed_post
        except Exception as e:
            logger.error(f"Failed to create ProcessedPost for story {story.id}: {e}")
            return None
    
    async def fetch_top_posts(
        self, 
        limit: int = 100,
        min_score: Optional[int] = None
    ) -> List[ProcessedPost]:
        """
        Fetch top posts from Hacker News.
        
        Args:
            limit: Maximum number of posts to fetch
            min_score: Minimum score required
            
        Returns:
            List of processed posts
        """
        logger.info(f"Fetching top {limit} HN posts (min_score: {min_score})")
        
        # Get top story IDs
        story_ids = await self.fetch_top_stories()
        if not story_ids:
            logger.warning("No story IDs fetched from HN")
            return []
        
        # Limit to requested number
        story_ids = story_ids[:limit]
        
        processed_posts = []
        
        # Process stories in batches to avoid overwhelming the API
        batch_size = 10
        for i in range(0, len(story_ids), batch_size):
            batch_ids = story_ids[i:i + batch_size]
            
            # Fetch stories and comments for this batch
            batch_tasks = [
                self.fetch_story_with_comments(story_id) 
                for story_id in batch_ids
            ]
            
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process each story in the batch
            for story_id, result in zip(batch_ids, batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Failed to fetch story {story_id}: {result}")
                    continue
                
                story, comments = result
                if not story:
                    continue
                
                # Apply minimum score filter
                if min_score and (not story.score or story.score < min_score):
                    continue
                
                # Process the story
                processed_post = await self.process_story(story, comments)
                if processed_post:
                    processed_posts.append(processed_post)
                    logger.debug(f"Processed story {story_id}: {story.title}")
        
        logger.info(f"Successfully processed {len(processed_posts)} HN posts")
        return processed_posts
    
    async def fetch_post_details(self, post_id: str) -> Optional[ProcessedPost]:
        """
        Fetch detailed information for a specific post.
        
        Args:
            post_id: HN post ID (with or without 'hn_' prefix)
            
        Returns:
            Processed post or None if not found
        """
        # Extract numeric ID
        if post_id.startswith("hn_"):
            hn_id = int(post_id[3:])
        else:
            hn_id = int(post_id)
        
        story, comments = await self.fetch_story_with_comments(hn_id)
        if not story:
            return None
        
        return await self.process_story(story, comments)
    
    async def health_check(self) -> bool:
        """Check if HN API is accessible."""
        try:
            url = f"{self.api_base_url}/maxitem.json"
            result = await self._make_request(url)
            return result is not None
        except Exception as e:
            logger.error(f"HN health check failed: {e}")
            return False