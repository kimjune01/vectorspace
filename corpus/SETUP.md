# Corpus Setup Guide

## Quick Start

1. **Set up environment**:
```bash
cd corpus/
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

2. **Install dependencies**:
```bash
uv sync
```

3. **Start the service**:
```bash
uv run python main.py
```

4. **Test the service**:
```bash
uv run python test_corpus.py
```

## Service URLs

- **API**: http://localhost:8001
- **Docs**: http://localhost:8001/docs  
- **Health**: http://localhost:8001/api/v1/debug/health

## Quick API Test

```bash
# Health check
curl http://localhost:8001/health

# Force a scraper run (backgrounds)
curl -X POST http://localhost:8001/api/v1/admin/scraper/force-run

# Check scraper status
curl http://localhost:8001/api/v1/admin/scraper/status
```

## Integration with VectorSpace

Once corpus is running, VectorSpace can call it for external content discovery:

```python
# In VectorSpace backend
import httpx

async def get_external_similar_content(conversation_embedding):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8001/api/v1/similarity/search",
            json={
                "embedding": conversation_embedding,
                "collections": ["hackernews"],
                "limit": 5,
                "min_similarity": 0.75
            }
        )
        return response.json()["results"]
```

## Environment Variables

Required:
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `CORPUS_PORT=8001`: Service port
- `SCRAPER_INTERVAL_MINUTES=60`: How often to scrape HN
- `MAX_POSTS_PER_SCRAPE=100`: Posts per scrape session
- `MIN_POST_SCORE=10`: Minimum HN score threshold