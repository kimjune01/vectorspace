from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import auth, conversation, websocket, search, admin, users
from app.database import Base, engine

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
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)