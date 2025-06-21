"""Background scraper manager and scheduler."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import schedule
import threading
import time

from ..models.responses import ScraperStatus
from ..scrapers.hackernews import HackerNewsScraper
from .vector_db import VectorDBService
from .summarizer import SummarizerService

logger = logging.getLogger(__name__)


class ScraperManager:
    """Manages background scraping tasks and scheduling."""
    
    def __init__(
        self,
        vector_db: VectorDBService,
        summarizer: SummarizerService,
        scraper_interval_minutes: int = 60,
        max_posts_per_scrape: int = 100,
        min_post_score: int = 10
    ):
        self.vector_db = vector_db
        self.summarizer = summarizer
        self.scraper_interval_minutes = scraper_interval_minutes
        self.max_posts_per_scrape = max_posts_per_scrape
        self.min_post_score = min_post_score
        
        # Status tracking
        self._status = "idle"
        self._last_run: Optional[datetime] = None
        self._next_run: Optional[datetime] = None
        self._posts_processed = 0
        self._errors = []
        self._metrics = {}
        
        # Scheduler thread
        self._scheduler_thread: Optional[threading.Thread] = None
        self._stop_scheduler = False
        
        # Initialize scheduler
        self._setup_scheduler()
    
    def _setup_scheduler(self):
        """Set up the background scheduler."""
        # Schedule regular scraping
        schedule.every(self.scraper_interval_minutes).minutes.do(
            self._schedule_scraper_run
        )
        
        # Calculate next run time
        self._next_run = datetime.utcnow() + timedelta(minutes=self.scraper_interval_minutes)
        
        logger.info(f"Scraper scheduled to run every {self.scraper_interval_minutes} minutes")
    
    def _schedule_scraper_run(self):
        """Schedule a scraper run (called by the scheduler)."""
        if self._status == "running":
            logger.warning("Scraper already running, skipping scheduled run")
            return
        
        # Run in a new thread to avoid blocking the scheduler
        thread = threading.Thread(
            target=lambda: asyncio.run(self.run_scraper("hackernews"))
        )
        thread.daemon = True
        thread.start()
    
    def start_scheduler(self):
        """Start the background scheduler thread."""
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            logger.warning("Scheduler already running")
            return
        
        self._stop_scheduler = False
        self._scheduler_thread = threading.Thread(target=self._run_scheduler)
        self._scheduler_thread.daemon = True
        self._scheduler_thread.start()
        
        logger.info("Background scheduler started")
    
    def stop_scheduler(self):
        """Stop the background scheduler."""
        self._stop_scheduler = True
        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)
        
        logger.info("Background scheduler stopped")
    
    def _run_scheduler(self):
        """Run the scheduler in a loop."""
        while not self._stop_scheduler:
            schedule.run_pending()
            time.sleep(1)
    
    async def run_scraper(self, platform: str = "hackernews"):
        """
        Run the scraper for a specific platform.
        
        Args:
            platform: Platform to scrape ("hackernews", etc.)
        """
        if self._status == "running":
            logger.warning(f"Scraper already running, ignoring {platform} request")
            return
        
        self._status = "running"
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Starting {platform} scraper run")
            
            if platform == "hackernews":
                await self._run_hackernews_scraper()
            else:
                raise ValueError(f"Unsupported platform: {platform}")
            
            self._last_run = start_time
            self._next_run = datetime.utcnow() + timedelta(minutes=self.scraper_interval_minutes)
            self._status = "idle"
            
            runtime_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Scraper run completed in {runtime_seconds:.1f} seconds")
            
        except Exception as e:
            error_msg = f"Scraper run failed: {str(e)}"
            logger.error(error_msg)
            self._errors.append({
                "timestamp": datetime.utcnow().isoformat(),
                "error": error_msg,
                "platform": platform
            })
            
            # Keep only last 50 errors
            if len(self._errors) > 50:
                self._errors = self._errors[-50:]
            
            self._status = "error"
    
    async def _run_hackernews_scraper(self):
        """Run the Hacker News scraper."""
        async with HackerNewsScraper(
            rate_limit_per_second=1.0,
            summarizer=self.summarizer
        ) as scraper:
            
            # Health check first
            if not await scraper.health_check():
                raise Exception("Hacker News API is not accessible")
            
            # Fetch and process posts
            posts = await scraper.fetch_top_posts(
                limit=self.max_posts_per_scrape,
                min_score=self.min_post_score
            )
            
            if not posts:
                logger.warning("No posts fetched from Hacker News")
                return
            
            # Store in vector database
            added_count = await self.vector_db.add_posts(posts, "hackernews")
            
            self._posts_processed += added_count
            
            # Update metrics
            self._metrics.update({
                "last_hn_scrape": {
                    "timestamp": datetime.utcnow().isoformat(),
                    "posts_fetched": len(posts),
                    "posts_stored": added_count,
                    "min_score_threshold": self.min_post_score
                }
            })
            
            logger.info(f"HN scraper processed {len(posts)} posts, stored {added_count}")
    
    async def reindex_collection(self, collection_name: str):
        """
        Reindex a collection (rebuild embeddings).
        
        This is a placeholder for future implementation.
        """
        logger.info(f"Reindexing collection '{collection_name}' (not implemented)")
        # TODO: Implement reindexing logic
        # 1. Get all documents from collection
        # 2. Regenerate embeddings
        # 3. Update collection
    
    def get_status(self) -> ScraperStatus:
        """Get current scraper status."""
        return ScraperStatus(
            status=self._status,
            last_run=self._last_run,
            next_run=self._next_run,
            posts_processed=self._posts_processed,
            errors=[error["error"] for error in self._errors[-10:]]  # Last 10 errors
        )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get detailed metrics."""
        return {
            **self._metrics,
            "total_posts_processed": self._posts_processed,
            "total_errors": len(self._errors),
            "scraper_config": {
                "interval_minutes": self.scraper_interval_minutes,
                "max_posts_per_scrape": self.max_posts_per_scrape,
                "min_post_score": self.min_post_score
            }
        }