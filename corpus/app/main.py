"""Corpus FastAPI application - External content discovery microservice."""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .routers import search, admin, debug
from .dependencies import get_scraper_manager

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Corpus service...")
    
    try:
        # Initialize and start the scraper manager
        scraper_manager = get_scraper_manager()
        scraper_manager.start_scheduler()
        logger.info("Background scraper scheduler started")
        
        yield
        
    finally:
        # Cleanup
        logger.info("Shutting down Corpus service...")
        try:
            scraper_manager = get_scraper_manager()
            scraper_manager.stop_scheduler()
            logger.info("Background scraper scheduler stopped")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


# Create FastAPI app
app = FastAPI(
    title="Corpus API",
    description="External content discovery microservice for VectorSpace",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Frontend development
        "http://localhost:8000",  # VectorSpace backend
        "https://vectorspace-production.up.railway.app",  # Production backend
        "https://bountiful-wholeness-production-eedc.up.railway.app",  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search.router)
app.include_router(admin.router)
app.include_router(debug.router)


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "corpus",
        "version": "0.1.0",
        "description": "External content discovery microservice",
        "docs": "/docs",
        "health": "/api/v1/debug/health"
    }


@app.get("/health")
async def simple_health():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "corpus"}


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    # Railway uses PORT, fallback to CORPUS_PORT for local development
    port = int(os.getenv("PORT") or os.getenv("CORPUS_PORT", "8001"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    logger.info(f"Starting Corpus service on {host}:{port}")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )