# VectorSpace Backend

FastAPI backend for the VectorSpace conversation discovery platform.

## Quick Start

```bash
# Install dependencies
uv sync

# Start the development server
uv run python main.py
```

The API will be available at:
- **Main API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **WebSocket**: ws://localhost:8000/api/ws/conversations/{id}
- **Corpus Proxy**: http://localhost:8000/api/corpus/* (requires corpus service on port 8001)

## Testing

```bash
# Run all tests (229 tests, comprehensive coverage)
uv run python -m pytest

# Run with coverage
uv run python -m pytest --cov=app

# Run specific test module
uv run python -m pytest tests/test_auth.py -v
```

## Key Features

- **JWT Authentication** - Secure user authentication with non-expiring tokens
- **Real-time Chat** - WebSocket integration with AI streaming responses
- **Semantic Search** - ChromaDB vector embeddings for intelligent content discovery
- **User Profiles** - Customizable profiles with image upload support
- **Auto-Processing** - Conversation summarization, archiving, and PII filtering
- **Background Tasks** - Automated maintenance and cleanup processes

## API Documentation

Full API documentation is available at http://localhost:8000/docs when the server is running.

## Configuration

The backend works out of the box with default settings. For production or custom configuration, create a `.env` file:

```bash
# Optional AI integration
OPENAI_API_KEY=your-openai-api-key-here

# Optional JWT secret (auto-generated if not provided)
JWT_SECRET_KEY=your-super-secret-jwt-key-here

# Optional database URL (SQLite by default)
DATABASE_URL=sqlite+aiosqlite:///./conversations.db
```

## Architecture

- **FastAPI** - Modern async web framework with automatic OpenAPI docs
- **SQLAlchemy 2.0** - Async ORM with SQLite database  
- **ChromaDB** - Vector database for semantic search
- **WebSockets** - Real-time bidirectional communication
- **pytest** - Comprehensive testing framework (229+ tests)

## Production Deployment

### Docker Deployment (Recommended)

The backend includes an optimized Dockerfile that provides significant improvements over Nixpacks:

| Metric | Nixpacks | Docker | Improvement |
|--------|----------|--------|-------------|
| Image Size | 800MB-1.3GB | 200-500MB | 60-80% smaller |
| Build Time | 55s | 15-25s | 3x faster |
| Deploy Time | 32s | 5-10s | 5x faster |

```bash
# Build Docker image
docker build -t vectorspace-backend .

# Run with Docker
docker run -p 8000:8000 vectorspace-backend
```

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for detailed Docker deployment instructions.

### Railway Deployment

The project is configured to use Docker on Railway automatically:

1. Push to your Railway-connected repository
2. Railway will detect and use the Dockerfile
3. Environment variables are set via Railway dashboard

### Production Considerations

- **Database**: Use PostgreSQL instead of SQLite for production
- **Environment**: Set `ENVIRONMENT=production` 
- **Secrets**: Configure `JWT_SECRET_KEY` and `OPENAI_API_KEY`
- **CORS**: Update allowed origins for your frontend domain
- **Monitoring**: Add logging and monitoring services