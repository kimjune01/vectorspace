from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import logging

logger = logging.getLogger(__name__)

# Require PostgreSQL - no SQLite fallback
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Please provide a PostgreSQL connection string."
    )

# Convert Railway's postgres:// to postgresql+asyncpg:// for async support
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    logger.info("Converted postgres:// URL to postgresql+asyncpg:// for async support")

# Validate that we're using PostgreSQL
if not DATABASE_URL.startswith(("postgresql://", "postgresql+asyncpg://")):
    raise ValueError(
        f"Only PostgreSQL databases are supported. "
        f"DATABASE_URL must start with 'postgresql://' or 'postgresql+asyncpg://'. "
        f"Got: {DATABASE_URL[:30]}..."
    )

# Create async engine with PostgreSQL-optimized settings
engine = create_async_engine(
    DATABASE_URL,
    echo=True if os.getenv("DEBUG") and not os.getenv("TESTING") else False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Validate connections before use
)
logger.info("Database engine configured for PostgreSQL")

# Create async session factory
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

async def get_db():
    """Dependency to get database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_database():
    """Initialize database tables."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

async def check_database_connection():
    """Check if database connection is working."""
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Test connection with a simple query
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection check successful")
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False