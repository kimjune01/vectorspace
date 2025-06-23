"""FastAPI dependency injection."""

import os
from functools import lru_cache
from typing import Optional

from .services.vector_db import VectorDBService
from .services.summarizer import SummarizerService
from .services.scraper_manager import ScraperManager


@lru_cache()
def get_vector_db() -> VectorDBService:
    """Get ChromaDB service instance."""
    return VectorDBService(
        persist_directory=os.getenv("CHROMADB_PATH", "./chroma_db")
    )


@lru_cache()
def get_summarizer() -> Optional[SummarizerService]:
    """Get summarization service instance (optional)."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    
    return SummarizerService(
        api_key=api_key,
        model=os.getenv("SUMMARIZATION_MODEL", "gpt-3.5-turbo")
    )


@lru_cache()
def get_scraper_manager() -> Optional[ScraperManager]:
    """Get scraper manager instance (optional)."""
    summarizer = get_summarizer()
    if not summarizer:
        return None
        
    return ScraperManager(
        vector_db=get_vector_db(),
        summarizer=summarizer,
        scraper_interval_minutes=int(os.getenv("SCRAPER_INTERVAL_MINUTES", "15")),
        max_posts_per_scrape=int(os.getenv("MAX_POSTS_PER_SCRAPE", "100")),
        min_post_score=int(os.getenv("MIN_POST_SCORE", "10"))
    )