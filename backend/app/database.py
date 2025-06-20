from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool
import os
import logging

logger = logging.getLogger(__name__)

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./conversations.db")

# Determine if we're using PostgreSQL
is_postgres = DATABASE_URL.startswith(("postgresql://", "postgresql+asyncpg://"))

# Convert Railway's postgres:// to postgresql+asyncpg:// for async support
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    logger.info("Converted postgres:// URL to postgresql+asyncpg:// for async support")

# Create async engine with appropriate settings
if is_postgres:
    # PostgreSQL production settings
    engine = create_async_engine(
        DATABASE_URL,
        echo=True if os.getenv("DEBUG") and not os.getenv("TESTING") else False,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_pre_ping=True,  # Validate connections before use
    )
    logger.info("Database engine configured for PostgreSQL")
else:
    # SQLite development settings
    engine = create_async_engine(
        DATABASE_URL,
        echo=True if os.getenv("DEBUG") and not os.getenv("TESTING") else False,
        poolclass=NullPool,
    )
    logger.info("Database engine configured for SQLite")

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