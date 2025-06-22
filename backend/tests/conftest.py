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
    """Use PostgreSQL test database for all tests."""
    return "postgresql+asyncpg://postgres:postgres@localhost:5432/vectorspace_test"

@pytest_asyncio.fixture(scope="function")
async def engine(_database_url):
    """Create an async SQLAlchemy engine for testing - shared across session."""
    from app.database import Base
    # Import all models to ensure they're registered with Base.metadata
    import app.models  # This registers all model classes with Base
    
    # Use PostgreSQL test database
    engine = create_async_engine(
        _database_url,
        echo=False,  # Disable SQL logging for performance
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    try:
        yield engine
    finally:
        await engine.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    """Create a new database session for each test."""
    from app.database import Base
    # Ensure models are imported
    import app.models
    
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


@pytest_asyncio.fixture
async def test_user(db_session):
    """Create a test user."""
    from app.models import User
    user = User(
        username="testuser",
        display_name="Test User",
        email="test@example.com",
        password_hash="hashed_password",
        bio="Test user bio"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_users(db_session):
    """Create multiple test users."""
    from app.models import User
    users = []
    for i in range(5):
        user = User(
            username=f"testuser{i}",
            display_name=f"Test User {i}",
            email=f"test{i}@example.com",
            password_hash="hashed_password",
            bio=f"Test user {i} bio"
        )
        db_session.add(user)
        users.append(user)
    
    await db_session.commit()
    for user in users:
        await db_session.refresh(user)
    return users


@pytest_asyncio.fixture
async def test_conversation(db_session, test_user):
    """Create a test conversation."""
    from app.models import Conversation
    conversation = Conversation(
        user_id=test_user.id,
        title="Test Conversation",
        summary_public="A test conversation about testing",
        is_public=True
    )
    db_session.add(conversation)
    await db_session.commit()
    await db_session.refresh(conversation)
    return conversation


@pytest_asyncio.fixture
async def test_conversations(db_session, test_user):
    """Create multiple test conversations."""
    from app.models import Conversation
    conversations = []
    for i in range(5):
        conversation = Conversation(
            user_id=test_user.id,
            title=f"Test Conversation {i}",
            summary_public=f"A test conversation about topic {i}",
            is_public=True
        )
        db_session.add(conversation)
        conversations.append(conversation)
    
    await db_session.commit()
    for conversation in conversations:
        await db_session.refresh(conversation)
    return conversations


@pytest_asyncio.fixture
async def auth_client(test_user, override_get_db):
    """Create an authenticated HTTP client for testing."""
    from app.auth import create_access_token
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    
    # Create access token for test user
    access_token = create_access_token(data={"sub": test_user.username})
    
    # Create client with auth headers
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.headers.update({"Authorization": f"Bearer {access_token}"})
        yield client