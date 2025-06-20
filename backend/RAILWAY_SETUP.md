# Railway PostgreSQL Setup Guide

## Quick Setup Steps

### 1. Add PostgreSQL Service
In your Railway dashboard:
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway will automatically provision the PostgreSQL database
3. The `DATABASE_URL` environment variable will be automatically set

### 2. Set Required Environment Variables
In Railway dashboard → Variables:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Deploy
Railway will automatically:
- Build the Docker image
- Run database migrations (`migrate.py`)
- Start the application
- Connect to PostgreSQL with proper connection pooling

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Auto-set | SQLite | PostgreSQL connection string (Railway provides) |
| `OPENAI_API_KEY` | Yes | None | OpenAI API key for embeddings |
| `ENVIRONMENT` | Auto-set | development | Set to "production" in railway.toml |
| `LOG_LEVEL` | Auto-set | DEBUG | Set to "INFO" in railway.toml |
| `JWT_SECRET_KEY` | No | Auto-generated | Custom JWT secret |

## Database Features

### Automatic Configuration
- **SQLite**: Local development (single file database)
- **PostgreSQL**: Production (connection pooling, SSL, auto-reconnect)

### Connection Pooling (PostgreSQL)
```python
pool_size=10          # Base connections
max_overflow=20       # Additional connections
pool_recycle=3600     # Recycle after 1 hour
pool_pre_ping=True    # Validate before use
```

### Migration Strategy
- Runs `migrate.py` before each deployment
- Creates tables if they don't exist
- Safe to run multiple times (idempotent)
- No data loss on re-runs

## Health Check
The `/health` endpoint returns database status:
```json
{
  "status": "healthy",
  "database": "connected",
  "services": {
    "api": "running",
    "websocket": "running", 
    "database": "connected"
  }
}
```

## Troubleshooting

### Database Connection Issues
1. Check Railway dashboard → Variables → `DATABASE_URL` exists
2. Check logs: `railway logs --service backend`
3. Test health endpoint: `curl https://your-app.railway.app/health`

### Migration Failures
- Check database permissions
- Verify PostgreSQL service is running
- Check for conflicting table schemas

### Performance Issues
- Monitor connection pool usage in logs
- Check for long-running queries
- Consider adding database indexes if needed

## Local Development
For local development, the app uses SQLite by default:
```bash
# No DATABASE_URL needed for local development
uv run python main.py
```

To test with PostgreSQL locally:
```bash
# Set DATABASE_URL to your local postgres
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost/vectorspace"
uv run python migrate.py
uv run python main.py
```