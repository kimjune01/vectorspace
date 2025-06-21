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
        persist_directory=os.getenv("CHROMADB_PATH", "./chroma_db"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    )


@lru_cache()
def get_summarizer() -> SummarizerService:
    """Get summarization service instance."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    return SummarizerService(
        api_key=api_key,
        model=os.getenv("SUMMARIZATION_MODEL", "gpt-3.5-turbo")
    )


@lru_cache()
def get_scraper_manager() -> ScraperManager:
    """Get scraper manager instance."""
    return ScraperManager(
        vector_db=get_vector_db(),
        summarizer=get_summarizer(),
        scraper_interval_minutes=int(os.getenv("SCRAPER_INTERVAL_MINUTES", "60")),
        max_posts_per_scrape=int(os.getenv("MAX_POSTS_PER_SCRAPE", "100")),
        min_post_score=int(os.getenv("MIN_POST_SCORE", "10"))
    )