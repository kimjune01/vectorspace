import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import auth, conversation, websocket, search, admin, users
from app.database import Base, engine
from app.services.presence_manager import start_presence_cleanup_task
from app.services.websocket_manager import websocket_manager
from app.services.heartbeat_manager import get_heartbeat_manager
from app.services.presence_metrics import presence_metrics

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="VectorSpace API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
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

@app.get("/")
async def root():
    return {"message": "Welcome to VectorSpace API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Create tables on startup (for development)
@app.on_event("startup")
async def startup_event():
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
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