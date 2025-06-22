# Corpus Service Deployment Guide

## Overview

The Corpus service is a microservice for external content discovery in VectorSpace. It scrapes, summarizes, and provides semantic search for external content like Hacker News posts.

## Production Dependencies

- **ChromaDB**: Uses free default embeddings (all-MiniLM-L6-v2) - no API keys needed
- **OpenAI API**: Only required for content summarization (optional feature)

## Railway Deployment

### 1. Create New Railway Service

```bash
# Connect to Railway (install railway CLI first)
railway login
railway init corpus-service
```

### 2. Environment Variables

Set these in Railway dashboard or via CLI:

```bash
# Required for summarization (optional)
railway variables set OPENAI_API_KEY=your-openai-api-key

# Optional overrides (have sensible defaults)
railway variables set SCRAPER_INTERVAL_MINUTES=60
railway variables set MAX_POSTS_PER_SCRAPE=100
railway variables set MIN_POST_SCORE=10
railway variables set LOG_LEVEL=INFO
```

### 3. Deploy

```bash
# Deploy from corpus directory
railway up
```

### 4. Verify Deployment

```bash
# Check health
curl https://your-corpus-service.railway.app/health

# Check API docs
curl https://your-corpus-service.railway.app/docs
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8001 | Service port (set by Railway) |
| `OPENAI_API_KEY` | No | - | For content summarization |
| `SCRAPER_INTERVAL_MINUTES` | No | 60 | How often to scrape content |
| `MAX_POSTS_PER_SCRAPE` | No | 100 | Max posts per scrape session |
| `MIN_POST_SCORE` | No | 10 | Minimum post score to scrape |
| `LOG_LEVEL` | No | INFO | Logging level |
| `DEBUG` | No | false | Enable debug mode |

### Service Features

- **Content Scraping**: Automatically scrapes Hacker News posts
- **Semantic Search**: Vector similarity search using ChromaDB
- **Content Summarization**: AI-powered post summarization (requires OpenAI)
- **Health Monitoring**: Built-in health checks and monitoring
- **CORS Support**: Configured for VectorSpace frontend/backend

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check
- `GET /docs` - Interactive API documentation
- `GET /api/v1/search/similarity` - Semantic search
- `GET /api/v1/debug/health` - Detailed health check
- `POST /api/v1/admin/scrape` - Manual scrape trigger

## Monitoring

### Health Checks

The service includes multiple health check endpoints:

- Simple: `/health`
- Detailed: `/api/v1/debug/health`

### Logs

View logs via Railway dashboard or CLI:

```bash
railway logs
```

## Troubleshooting

### Common Issues

1. **Service won't start**: Check PORT environment variable and logs
2. **Scraping fails**: Verify network connectivity and rate limits
3. **Summarization fails**: Check OPENAI_API_KEY configuration
4. **High memory usage**: Check ChromaDB database size

### Debug Commands

```bash
# Check service status
railway status

# View logs
railway logs --follow

# Check environment variables
railway variables
```

## Cost Optimization

- **Embeddings**: Uses free ChromaDB default embeddings
- **Summarization**: Optional OpenAI usage (estimate: $0.01-0.10/day)
- **Compute**: Railway's free tier sufficient for development
- **Storage**: ChromaDB data persisted in Railway volume