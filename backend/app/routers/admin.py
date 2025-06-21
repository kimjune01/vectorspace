from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from typing import Dict, List, Optional
import time
import os
from app.services.websocket_manager import websocket_manager
from app.services.presence_manager import presence_manager
from app.services.heartbeat_manager import get_heartbeat_manager
from app.services.presence_metrics import presence_metrics

router = APIRouter()
security = HTTPBearer()


@router.get("/stats/websocket")
async def get_websocket_stats() -> Dict:
    """Get WebSocket connection statistics."""
    return websocket_manager.get_stats()


@router.get("/stats/presence")
async def get_presence_stats() -> Dict:
    """Get presence manager statistics."""
    return presence_manager.get_stats()


@router.get("/stats/heartbeat")
async def get_heartbeat_stats() -> Dict:
    """Get heartbeat manager statistics."""
    heartbeat_manager = get_heartbeat_manager(websocket_manager)
    return heartbeat_manager.get_stats()


@router.get("/stats/metrics")
async def get_presence_metrics() -> Dict:
    """Get comprehensive presence metrics."""
    return presence_metrics.get_global_stats()


@router.get("/stats/metrics/conversation/{conversation_id}")
async def get_conversation_metrics(conversation_id: int) -> Optional[Dict]:
    """Get detailed metrics for a specific conversation."""
    stats = presence_metrics.get_conversation_stats(conversation_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return stats


@router.get("/stats/metrics/time-series/{metric}")
async def get_time_series_metrics(
    metric: str, 
    duration_minutes: int = 60
) -> List[Dict]:
    """Get time-series data for a specific metric."""
    available_metrics = ["concurrent_users", "messages_per_minute", "events_per_minute", "new_sessions_per_minute"]
    
    if metric not in available_metrics:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid metric. Available: {available_metrics}"
        )
    
    return presence_metrics.get_time_series(metric, duration_minutes)


@router.get("/stats/comprehensive")
async def get_comprehensive_stats() -> Dict:
    """Get all system statistics in one response."""
    return {
        "websocket": websocket_manager.get_stats(),
        "presence": presence_manager.get_stats(),
        "heartbeat": get_heartbeat_manager(websocket_manager).get_stats(),
        "metrics": presence_metrics.get_global_stats(),
        "timestamp": time.time()
    }


@router.post("/cleanup/stale-connections")
async def cleanup_stale_connections(max_idle_minutes: int = 30) -> Dict:
    """Manually trigger cleanup of stale WebSocket connections."""
    cleaned_count = await websocket_manager.cleanup_stale_connections(max_idle_minutes)
    return {
        "cleaned_connections": cleaned_count,
        "timestamp": time.time()
    }


@router.post("/cleanup/inactive-users")
async def cleanup_inactive_users(timeout_seconds: int = 300) -> Dict:
    """Manually trigger cleanup of inactive users."""
    await presence_manager.cleanup_inactive_users(timeout_seconds)
    return {
        "cleanup_completed": True,
        "timeout_seconds": timeout_seconds,
        "timestamp": time.time()
    }


@router.get("/health/detailed")
async def detailed_health_check() -> Dict:
    """Detailed health check including all presence system components."""
    heartbeat_manager = get_heartbeat_manager(websocket_manager)
    
    return {
        "status": "healthy",
        "components": {
            "websocket_manager": {
                "status": "healthy",
                "connections": len(websocket_manager.connection_lookup)
            },
            "presence_manager": {
                "status": "healthy",
                "conversations": len(presence_manager._presence_data)
            },
            "heartbeat_manager": {
                "status": "healthy" if heartbeat_manager.is_running else "stopped",
                "pending_pongs": len(heartbeat_manager.pending_pongs)
            },
            "metrics_collector": {
                "status": "healthy" if presence_metrics.is_running else "stopped",
                "active_sessions": len([s for s in presence_metrics.session_metrics.values() if s.is_active])
            }
        },
        "timestamp": time.time()
    }


@router.get("/ai/config")
async def get_ai_config() -> Dict:
    """Get AI service configuration for debugging."""
    from app.services.ai_service import ai_service
    
    return {
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY")),
        "api_key_length": len(os.getenv("OPENAI_API_KEY", "")) if os.getenv("OPENAI_API_KEY") else 0,
        "api_key_prefix": os.getenv("OPENAI_API_KEY", "")[:8] + "..." if os.getenv("OPENAI_API_KEY") else None,
        "model": ai_service.model,
        "max_tokens": ai_service.max_tokens,
        "temperature": ai_service.temperature,
        "client_configured": ai_service.client is not None,
        "environment_vars": {
            "AI_MODEL": os.getenv("AI_MODEL"),
            "AI_MAX_TOKENS": os.getenv("AI_MAX_TOKENS"),
            "AI_TEMPERATURE": os.getenv("AI_TEMPERATURE")
        }
    }


@router.get("/ai/test")
async def test_ai_connection() -> Dict:
    """Test OpenAI API connection."""
    from app.services.ai_service import ai_service
    
    if not ai_service.client:
        return {"error": "OpenAI client not configured", "using_mock": True}
    
    try:
        # Simple API test - list models
        models = await ai_service.client.models.list()
        return {
            "success": True,
            "models_available": len(models.data),
            "first_model": models.data[0].id if models.data else None
        }
    except Exception as e:
        # Get API key for debugging
        api_key = os.getenv("OPENAI_API_KEY", "")
        key_info = {
            "first_8": api_key[:8] if len(api_key) >= 8 else api_key,
            "last_8": api_key[-8:] if len(api_key) >= 8 else api_key,
            "length": len(api_key)
        }
        
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "api_key_debug": key_info
        }


@router.get("/users/debug")
async def debug_users() -> Dict:
    """Debug user data in production database."""
    from app.database import get_db
    from app.models import User
    from sqlalchemy import select
    
    async for db in get_db():
        try:
            # Get all users with basic info
            result = await db.execute(select(User.username, User.email, User.display_name, User.created_at, User.password_hash).limit(10))
            users = result.all()
            
            user_data = []
            for user in users:
                user_data.append({
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
                    "created_at": str(user.created_at),
                    "has_password": bool(user.password_hash),
                    "password_prefix": user.password_hash[:20] + "..." if user.password_hash else None
                })
            
            return {
                "success": True,
                "total_users": len(users),
                "users": user_data
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }
        finally:
            break