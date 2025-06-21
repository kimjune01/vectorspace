"""Administrative API endpoints for collection management."""

import logging
from typing import Dict, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks

from ..models.responses import CollectionStats, ScraperStatus
from ..services.vector_db import VectorDBService
from ..services.scraper_manager import ScraperManager
from ..dependencies import get_vector_db, get_scraper_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/collections", response_model=List[str])
async def list_collections(
    vector_db: VectorDBService = Depends(get_vector_db)
) -> List[str]:
    """List all ChromaDB collections."""
    try:
        return vector_db.list_collections()
    except Exception as e:
        logger.error(f"Failed to list collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list collections: {str(e)}"
        )


@router.get("/collections/{collection_name}/stats", response_model=CollectionStats)
async def get_collection_stats(
    collection_name: str,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> CollectionStats:
    """Get detailed statistics for a specific collection."""
    try:
        stats = await vector_db.get_collection_stats(collection_name)
        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}' not found"
            )
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get collection stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get collection stats: {str(e)}"
        )


@router.delete("/collections/{collection_name}")
async def delete_collection(
    collection_name: str,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> Dict[str, str]:
    """Delete a collection and all its data."""
    try:
        success = await vector_db.delete_collection(collection_name)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}' not found"
            )
        
        return {"message": f"Collection '{collection_name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete collection: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete collection: {str(e)}"
        )


@router.post("/collections/{collection_name}/reindex")
async def reindex_collection(
    collection_name: str,
    background_tasks: BackgroundTasks,
    vector_db: VectorDBService = Depends(get_vector_db),
    scraper_manager: ScraperManager = Depends(get_scraper_manager)
) -> Dict[str, str]:
    """Rebuild embeddings for a collection (background task)."""
    try:
        # Check if collection exists
        stats = await vector_db.get_collection_stats(collection_name)
        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}' not found"
            )
        
        # Add reindexing task to background
        background_tasks.add_task(
            scraper_manager.reindex_collection,
            collection_name
        )
        
        return {
            "message": f"Reindexing started for collection '{collection_name}'",
            "status": "background_task_queued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start reindexing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start reindexing: {str(e)}"
        )


@router.get("/scraper/status", response_model=ScraperStatus)
async def get_scraper_status(
    scraper_manager: ScraperManager = Depends(get_scraper_manager)
) -> ScraperStatus:
    """Get current status of the background scraper."""
    try:
        return scraper_manager.get_status()
    except Exception as e:
        logger.error(f"Failed to get scraper status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scraper status: {str(e)}"
        )


@router.post("/scraper/force-run")
async def force_scraper_run(
    background_tasks: BackgroundTasks,
    platform: str = "hackernews",
    scraper_manager: ScraperManager = Depends(get_scraper_manager)
) -> Dict[str, str]:
    """Manually trigger a scraper run (background task)."""
    try:
        if platform not in ["hackernews"]:  # Add more platforms as implemented
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: {platform}"
            )
        
        # Add scraping task to background
        background_tasks.add_task(
            scraper_manager.run_scraper,
            platform
        )
        
        return {
            "message": f"Scraper run started for platform '{platform}'",
            "status": "background_task_queued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start scraper: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start scraper: {str(e)}"
        )