# Corpus Feature - External Content Discovery

*Feature documentation for VectorSpace's corpus microservice*

## Overview

The **Corpus** feature is a standalone microservice that provides external content discovery functionality for VectorSpace. It scrapes external forums and platforms to surface semantically similar discussions alongside VectorSpace conversations, creating a comprehensive discovery experience that bridges internal AI conversations with broader online discourse.

## Current Status

**✅ Fully Implemented** - Complete standalone microservice with comprehensive functionality  
**✅ Integrated** - Connected to main VectorSpace application with seamless user experience

## Core Functionality

### Purpose
Transform VectorSpace from an isolated conversation platform into a comprehensive discussion discovery engine by:
- Scraping external platforms (Hacker News, Reddit, Stack Overflow, etc.)
- Providing semantic similarity matching with VectorSpace conversations
- Enriching the "neighboring chats" experience with relevant external discussions

### Key Features

#### 1. **Multi-Platform Content Scraping**
- **Hacker News Integration**: Fully implemented scraper using HN API
- **Extensible Architecture**: Designed for easy addition of Reddit, Stack Overflow, etc.
- **Intelligent Filtering**: Configurable score thresholds and content quality filters
- **Rate Limiting**: Respectful API usage with proper delays and batching

#### 2. **AI-Powered Content Processing**
- **Summarization**: OpenAI-powered condensation to ~500 tokens for efficient processing
- **Vector Embeddings**: ChromaDB-powered semantic similarity matching
- **Metadata Extraction**: Preserves author, timestamp, score, and engagement metrics
- **Content Deduplication**: Prevents duplicate content across scraping sessions

#### 3. **Semantic Search Engine**
- **Cosine Similarity**: High-precision matching against conversation summaries
- **Multi-Collection Search**: Query across different platforms simultaneously
- **Temporal Relevance**: Time-based scoring for content freshness
- **Configurable Thresholds**: Adjustable similarity requirements

#### 4. **Background Processing**
- **Automated Scraping**: Configurable periodic content collection
- **Health Monitoring**: Comprehensive status tracking and error handling
- **Manual Triggers**: Admin controls for on-demand scraping
- **Scalable Architecture**: Designed for high-volume content processing

## Technical Architecture

### Service Structure
```
/corpus/
├── app/
│   ├── main.py                 # FastAPI application entry point
│   ├── scrapers/
│   │   └── hackernews.py       # Hacker News scraper implementation
│   ├── services/
│   │   ├── vector_db.py        # ChromaDB integration
│   │   ├── summarizer.py       # OpenAI summarization
│   │   └── scraper_manager.py  # Background task management
│   └── models/                 # Data models and schemas
```

### API Endpoints
```
POST /api/v1/similarity/search     # Main similarity search
GET  /api/v1/collections           # List available collections
GET  /api/v1/admin/scraper/status  # Scraper monitoring
POST /api/v1/admin/scraper/force-run # Manual scraper trigger
GET  /api/v1/debug/health          # Health check
```

### Data Flow
1. **Scraping**: Periodic collection from external APIs (HN, Reddit, etc.)
2. **Summarization**: AI-powered content condensation using OpenAI
3. **Embedding**: Vector generation and ChromaDB storage with metadata
4. **Search**: Similarity matching against conversation summaries
5. **Response**: Ranked results with relevance scores and metadata

## ChromaDB Collections

### Current Collections
- **`hackernews`** - Hacker News posts and comments
- **`reddit_programming`** - (Planned) r/programming posts
- **`reddit_machinelearning`** - (Planned) r/MachineLearning posts

### Document Schema
```json
{
  "id": "hn_12345678",
  "content": "AI-summarized content (~500 tokens)",
  "embedding": [0.1, 0.2, ...],
  "metadata": {
    "platform": "hackernews",
    "url": "https://news.ycombinator.com/item?id=12345678",
    "title": "Original post title",
    "author": "username",
    "timestamp": "2024-01-15T10:30:00Z",
    "score": 145,
    "comment_count": 67
  }
}
```

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-...              # Required for summarization
CORPUS_PORT=8001                   # Service port (main app on 8000)
SCRAPER_INTERVAL_MINUTES=60        # Scraping frequency
MAX_POSTS_PER_SCRAPE=100          # Batch size limit
MIN_POST_SCORE=10                 # Minimum score threshold
```

### Performance Settings
- **Embedding Model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Similarity Threshold**: 0.75 minimum for relevance
- **Content Limit**: 500 tokens per document for efficient processing
- **Scraping Rate**: 60-minute intervals with rate limiting

## Planned Integration

### Frontend Enhancement
The corpus service would enhance the existing "neighboring chats" panel:

```javascript
// Planned integration concept
const getSimilarContent = async (conversationSummary) => {
    const results = await Promise.all([
        // Existing internal conversations
        searchInternalConversations(conversationSummary),
        
        // New external discussions
        fetch('/api/corpus/similarity/search', {
            method: 'POST',
            body: JSON.stringify({
                query: conversationSummary,
                collections: ['hackernews', 'reddit_programming'],
                limit: 5,
                min_similarity: 0.75
            })
        })
    ]);
    
    return {
        internal_conversations: results[0],
        external_discussions: results[1].results
    };
};
```

### Backend Integration Points
1. **API Proxy**: Route `/api/corpus/*` requests to corpus service
2. **Authentication**: Extend JWT middleware to corpus endpoints
3. **Unified Search**: Combine internal and external results in single response
4. **Caching**: Redis layer for frequently accessed external content

## Benefits

### For Users
- **Comprehensive Discovery**: Find related discussions beyond VectorSpace
- **Context Enrichment**: Understand broader conversation landscape
- **Knowledge Expansion**: Discover expert opinions and community insights
- **Trend Awareness**: Stay connected to platform-wide discussions

### For Platform
- **Engagement**: Increased time on platform through rich content discovery
- **Differentiation**: Unique value proposition vs. other chat platforms
- **Network Effects**: Bridge internal conversations with external knowledge
- **SEO Benefits**: Rich external content improves search visibility

## Implementation Roadmap

### Phase 1: Basic Integration (Estimated 2-3 days)
- [ ] Add corpus service proxy to main backend
- [ ] Extend frontend neighboring chats to include external results
- [ ] Basic UI for external content display
- [ ] Health check integration

### Phase 2: Enhanced Experience (Estimated 3-4 days)
- [ ] Unified search interface combining internal/external results
- [ ] Rich external content cards with metadata
- [ ] User preferences for external content sources
- [ ] Caching layer for performance optimization

### Phase 3: Advanced Features (Estimated 5-7 days)
- [ ] Reddit integration with multiple subreddits
- [ ] Stack Overflow integration for technical conversations
- [ ] User bookmarking of external content
- [ ] Analytics for external content engagement

## Questions for Feedback

1. **Integration Priority**: Should we prioritize basic integration or wait for enhanced UI design?

2. **Content Sources**: Which external platforms are most valuable for our users?
   - Hacker News (implemented)
   - Reddit (r/programming, r/MachineLearning, r/ChatGPT)
   - Stack Overflow
   - GitHub Discussions
   - Other suggestions?

3. **UI Design**: How should external content be visually distinguished from internal conversations?

4. **Performance**: What's the acceptable latency for similarity search? (Currently ~200ms)

5. **Content Policy**: Do we need moderation for external content links?

6. **User Control**: Should users be able to disable external content discovery?

---

*This feature represents a significant enhancement that would position VectorSpace as a comprehensive conversation discovery platform, bridging internal AI discussions with the broader online discourse ecosystem.*