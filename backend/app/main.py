import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file FIRST
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, conversation, websocket, search, admin, users, notifications, human_chat, corpus, collaboration
# Import curation conditionally to handle DATABASE_URL requirement
try:
    from app.routers import curation
    CURATION_AVAILABLE = True
except (ValueError, ImportError) as e:
    print(f"⚠️  Curation router not available: {e}")
    CURATION_AVAILABLE = False
from app.database import Base, engine, init_database, check_database_connection
from app.services.presence_manager import start_presence_cleanup_task
from app.services.websocket_manager import websocket_manager
from app.services.heartbeat_manager import get_heartbeat_manager
from app.services.presence_metrics import presence_metrics

app = FastAPI(title="VectorSpace API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Development
        "https://bountiful-wholeness-production-eedc.up.railway.app",  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(conversation.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(websocket.router, prefix="/api/ws", tags=["websocket"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
if CURATION_AVAILABLE:
    app.include_router(curation.router, prefix="/api", tags=["curation"])
app.include_router(human_chat.router, prefix="/api/human-chat", tags=["human-chat"])
app.include_router(corpus.router, prefix="/api/corpus", tags=["corpus"])
app.include_router(collaboration.router, prefix="/api/collaboration", tags=["collaboration"])

@app.get("/")
async def root():
    return {"message": "Welcome to VectorSpace API"}

@app.get("/health")
async def health_check():
    # Check database connection
    db_healthy = await check_database_connection()
    
    health_status = {
        "status": "healthy" if db_healthy else "unhealthy",
        "database": "connected" if db_healthy else "disconnected",
        "services": {
            "api": "running",
            "websocket": "running",
            "database": "connected" if db_healthy else "disconnected"
        }
    }
    
    return health_status


# Initialize database and services on startup
@app.on_event("startup")
async def startup_event():
    # Check database connection
    if not await check_database_connection():
        print("❌ Database connection failed - check DATABASE_URL")
        return
    
    # Initialize database tables
    await init_database()
    
    # Start presence cleanup task
    asyncio.create_task(start_presence_cleanup_task())
    
    # Start heartbeat manager
    heartbeat_manager = get_heartbeat_manager(websocket_manager)
    await heartbeat_manager.start_heartbeat_task()
    
    # Start presence metrics collection
    await presence_metrics.start_metrics_collection()
    
    print("🚀 VectorSpace API started with enhanced presence system")


@app.on_event("shutdown")
async def shutdown_event():
    # Stop heartbeat manager
    heartbeat_manager = get_heartbeat_manager(websocket_manager)
    await heartbeat_manager.stop_heartbeat_task()
    
    # Stop presence metrics collection
    await presence_metrics.stop_metrics_collection()
    
    print("🛑 VectorSpace API shutdown complete")

# Serve frontend static files in production
if os.getenv("ENVIRONMENT") == "production":
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    if os.path.exists(static_dir):
        from fastapi.staticfiles import StaticFiles
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
        print(f"📁 Serving frontend from {static_dir}")