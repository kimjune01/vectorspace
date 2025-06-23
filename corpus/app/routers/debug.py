"""Debug and monitoring API endpoints."""

import logging
import time
from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Depends

from ..models.responses import HealthCheckResponse, CollectionStats
from ..services.vector_db import VectorDBService
from ..services.summarizer import SummarizerService
from ..services.scraper_manager import ScraperManager
from ..dependencies import get_vector_db, get_summarizer, get_scraper_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/debug", tags=["debug"])

# Track service start time
SERVICE_START_TIME = time.time()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    vector_db: VectorDBService = Depends(get_vector_db),
    summarizer: SummarizerService = Depends(get_summarizer),
    scraper_manager: ScraperManager = Depends(get_scraper_manager)
) -> HealthCheckResponse:
    """Comprehensive service health check."""
    try:
        # Check ChromaDB
        db_healthy = await vector_db.health_check()
        
        # Check OpenAI summarizer
        summarizer_healthy = await summarizer.health_check()
        
        # Get collection stats
        collections_stats = {}
        if db_healthy:
            collection_names = vector_db.list_collections()
            for name in collection_names:
                stats = await vector_db.get_collection_stats(name)
                if stats:
                    collections_stats[name] = stats
        
        # Get scraper status
        scraper_status = scraper_manager.get_status()
        
        # Determine overall health
        overall_status = "healthy" if (db_healthy and summarizer_healthy) else "unhealthy"
        
        return HealthCheckResponse(
            status=overall_status,
            uptime_seconds=int(time.time() - SERVICE_START_TIME),
            collections=collections_stats,
            scraper={
                "status": scraper_status.status,
                "last_run": scraper_status.last_run,
                "next_run": scraper_status.next_run,
                "posts_processed": scraper_status.posts_processed,
                "error_count": len(scraper_status.errors),
                "healthy": scraper_status.status != "error"
            }
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="error",
            uptime_seconds=int(time.time() - SERVICE_START_TIME),
            collections={},
            scraper={"status": "unknown", "healthy": False}
        )


@router.get("/collections/{collection_name}/sample")
async def get_collection_sample(
    collection_name: str,
    limit: int = 5,
    vector_db: VectorDBService = Depends(get_vector_db)
) -> Dict[str, Any]:
    """Get sample documents from a collection for debugging."""
    try:
        # Get collection stats first to verify it exists
        stats = await vector_db.get_collection_stats(collection_name)
        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}' not found"
            )
        
        # Get sample documents
        collection = vector_db._get_collection(collection_name)
        sample_results = collection.peek(limit=limit)
        
        # Format sample data
        samples = []
        for i in range(len(sample_results.get("ids", []))):
            sample = {
                "id": sample_results["ids"][i],
                "content_preview": sample_results["documents"][i][:200] + "...",
                "metadata": sample_results["metadatas"][i]
            }
            samples.append(sample)
        
        return {
            "collection": collection_name,
            "total_documents": stats.document_count,
            "sample_count": len(samples),
            "samples": samples
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get collection sample: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get collection sample: {str(e)}"
        )


@router.get("/scraper/logs")
async def get_scraper_logs(
    limit: int = 50,
    scraper_manager: ScraperManager = Depends(get_scraper_manager)
) -> Dict[str, Any]:
    """Get recent scraper logs and metrics."""
    try:
        status = scraper_manager.get_status()
        
        return {
            "current_status": status.status,
            "last_run": status.last_run,
            "next_run": status.next_run,
            "posts_processed_total": status.posts_processed,
            "recent_errors": status.errors[-limit:] if status.errors else [],
            "error_count": len(status.errors),
            "scraper_metrics": scraper_manager.get_metrics()
        }
        
    except Exception as e:
        logger.error(f"Failed to get scraper logs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scraper logs: {str(e)}"
        )


@router.get("/system/info")
async def get_system_info() -> Dict[str, Any]:
    """Get system information and configuration."""
    try:
        import os
        import platform
        
        return {
            "service": {
                "name": "corpus",
                "version": "0.1.0",
                "uptime_seconds": int(time.time() - SERVICE_START_TIME),
                "start_time": datetime.fromtimestamp(SERVICE_START_TIME).isoformat()
            },
            "system": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "processor": platform.processor()
            },
            "environment": {
                "chromadb_path": os.getenv("CHROMADB_PATH", "./chroma_db"),
                "corpus_port": os.getenv("CORPUS_PORT", "8001"),
                "debug_mode": os.getenv("DEBUG", "false").lower() == "true",
                "log_level": os.getenv("LOG_LEVEL", "INFO"),
                "has_openai_key": bool(os.getenv("OPENAI_API_KEY"))
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get system info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get system info: {str(e)}"
        )


@router.get("/persistence/check")
async def check_data_persistence(
    vector_db: VectorDBService = Depends(get_vector_db)
) -> Dict[str, Any]:
    """Check if data is persisting between deployments."""
    try:
        import os
        import glob
        from pathlib import Path
        
        # Get ChromaDB path
        chromadb_path = os.getenv("CHROMADB_PATH", "./chroma_db")
        path = Path(chromadb_path)
        
        # Check if persistence directory exists
        path_exists = path.exists()
        path_is_dir = path.is_dir() if path_exists else False
        
        # Get directory contents
        files = []
        total_size = 0
        if path_exists and path_is_dir:
            for file_path in path.glob("**/*"):
                if file_path.is_file():
                    file_size = file_path.stat().st_size
                    files.append({
                        "path": str(file_path.relative_to(path)),
                        "size_bytes": file_size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                    })
                    total_size += file_size
        
        # Get collection info
        collections = vector_db.list_collections()
        collection_stats = {}
        total_documents = 0
        
        for name in collections:
            stats = await vector_db.get_collection_stats(name)
            if stats:
                collection_stats[name] = {
                    "document_count": stats.document_count,
                    "last_updated": stats.last_updated.isoformat() if stats.last_updated else None
                }
                total_documents += stats.document_count
        
        return {
            "persistence_status": "enabled" if path_exists else "not_found",
            "storage": {
                "path": str(path.absolute()),
                "exists": path_exists,
                "is_directory": path_is_dir,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_count": len(files),
                "files": files[:10]  # Show first 10 files
            },
            "collections": {
                "count": len(collections),
                "names": collections,
                "stats": collection_stats,
                "total_documents": total_documents
            },
            "service_info": {
                "uptime_seconds": int(time.time() - SERVICE_START_TIME),
                "start_time": datetime.fromtimestamp(SERVICE_START_TIME).isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Persistence check failed: {e}")
        return {
            "persistence_status": "error",
            "error": str(e),
            "service_info": {
                "uptime_seconds": int(time.time() - SERVICE_START_TIME),
                "start_time": datetime.fromtimestamp(SERVICE_START_TIME).isoformat()
            }
        }


@router.post("/test/summarizer")
async def test_summarizer(
    text: str = "This is a test post about artificial intelligence and machine learning.",
    summarizer: SummarizerService = Depends(get_summarizer)
) -> Dict[str, Any]:
    """Test the summarization service with custom text."""
    try:
        start_time = time.time()
        
        result = await summarizer.summarize(
            title="Test Post",
            content=text,
            max_tokens=200
        )
        
        test_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "input_text": text,
            "input_length": len(text),
            "summary": result.summary,
            "summary_tokens": result.token_count,
            "processing_time_ms": result.processing_time_ms,
            "total_test_time_ms": test_time_ms,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Summarizer test failed: {e}")
        return {
            "input_text": text,
            "error": str(e),
            "status": "failed"
        }