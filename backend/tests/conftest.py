import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
from pathlib import Path
from fastapi.testclient import TestClient

# Import test setup for performance optimizations
import tests.test_setup

# Set test environment
os.environ["TESTING"] = "1"
os.environ["CHROMA_DB_PATH"] = ":memory:"  # Use in-memory ChromaDB for tests
os.environ["AI_MAX_TOKENS"] = "100"  # Limit tokens for faster tests
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")  # Use OpenAI for embeddings if available

@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    """Create a temporary database file for testing."""
    return tmp_path_factory.mktemp("data") / "test.db"

@pytest.fixture(scope="session")
def _database_url():
    """Use a shared in-memory database for all tests."""
    return "sqlite+aiosqlite:///:memory:?cache=shared"

@pytest_asyncio.fixture(scope="session")
async def engine(_database_url):
    """Create an async SQLAlchemy engine for testing - shared across session."""
    from app.database import Base
    
    # Use in-memory database for speed
    engine = create_async_engine(
        _database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,  # Disable SQL logging for performance
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    """Create a new database session for each test."""
    from app.database import Base
    
    # Clean all tables before each test
    async with engine.begin() as conn:
        # Delete all data from tables
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    
    # Create session factory
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session

@pytest.fixture
def test_user_data():
    """Sample user data for testing."""
    return {
        "username": "testuser123",
        "display_name": "Test User",
        "password": "securepassword123",
        "bio": "Test bio"
    }

@pytest.fixture
def test_conversation_data():
    """Sample conversation data for testing."""
    return {
        "title": "Python Decorators Discussion",
        "messages": [
            {"role": "user", "content": "What are Python decorators?"},
            {"role": "assistant", "content": "Python decorators are a way to modify functions..."}
        ]
    }

@pytest.fixture
def override_get_db(db_session):
    """Override database dependency for testing."""
    from app.main import app
    from app.database import get_db
    
    async def _get_test_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()