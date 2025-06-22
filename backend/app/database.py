from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import logging

logger = logging.getLogger(__name__)

# Require PostgreSQL - no SQLite fallback, but allow tests to override
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL and not os.getenv("TESTING"):
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Please provide a PostgreSQL connection string."
    )

# Convert Railway's postgres:// to postgresql+asyncpg:// for async support
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    logger.info("Converted postgres:// URL to postgresql+asyncpg:// for async support")

# Validate that we're using PostgreSQL (skip validation in tests)
if DATABASE_URL and not DATABASE_URL.startswith(("postgresql://", "postgresql+asyncpg://")):
    raise ValueError(
        f"Only PostgreSQL databases are supported. "
        f"DATABASE_URL must start with 'postgresql://' or 'postgresql+asyncpg://'. "
        f"Got: {DATABASE_URL[:30]}..."
    )

# Create async engine with PostgreSQL-optimized settings (conditionally for tests)
if DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL,
        echo=True if os.getenv("DEBUG") and not os.getenv("TESTING") else False,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_pre_ping=True,  # Validate connections before use
    )
else:
    # Testing mode - engine will be created by tests
    engine = None
if DATABASE_URL:
    logger.info("Database engine configured for PostgreSQL")

# Create async session factory
if engine:
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
else:
    async_session = None

# Create declarative base
Base = declarative_base()

async def get_db():
    """Dependency to get database session."""
    if not async_session:
        raise RuntimeError("Database not configured. Set DATABASE_URL environment variable.")
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