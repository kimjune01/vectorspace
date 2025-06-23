# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VectorSpace** is a conversation discovery platform where users share AI chatbot conversations publicly, discover interesting conversations from others, and build profiles showcasing their AI interactions.

### Core Features
- **AI Conversation Sharing**: Public AI chat sessions with streaming responses
- **Semantic Discovery**: Vector-powered search and content discovery
- **Social Profiles**: User profiles showcasing conversation history
- **Curation System**: Save conversations and organize into collections
- **Real-time Chat**: WebSocket-powered interactions with message streaming

## Architecture Overview

### Backend (`/backend/`)
- **FastAPI** (async Python) with PostgreSQL + SQLAlchemy
- **Vector Search**: ChromaDB for semantic conversation discovery
- **Authentication**: JWT tokens with non-expiring sessions
- **Real-time**: WebSocket for AI chat and user messaging
- **AI Integration**: Configurable service layer (OpenAI/Anthropic/Mock)

### Frontend (`/frontend/`)
- **Vite + React + TypeScript** with shadcn/ui components
- **State Management**: TanStack Query + Zustand
- **Authentication**: JWT with protected routes
- **Development Tools**: API logging, debug panel, enhanced error handling

### Corpus Service (`/corpus/`)
- **FastAPI microservice** for external content discovery (Hacker News, etc.)
- **ChromaDB instance** for vector similarity search
- **Proxied endpoints** through main backend at `/api/corpus/*`

## Development Setup

### Prerequisites & Tools
- **Python**: Use `uv` for dependency management (backend/corpus)
- **Node.js**: Use `pnpm` instead of `npm` for all JavaScript projects
- **Database**: PostgreSQL with environment-specific configuration
- **Git**: Non-destructive commands can be executed without approval

### Quick Start
```bash
# Backend
cd backend && uv run python main.py          # Port 8000

# Backend with mock HN recommendations (for testing)
cd backend && MOCK_HN_RECOMMENDATIONS=true uv run python main.py

# Frontend  
cd frontend && pnpm install && pnpm run dev  # Port 5173

# Corpus (optional)
cd corpus && uv run python main.py           # Port 8001

# Database seeding
cd backend && uv run python seed_database.py # Creates testuser/testpass
```

### Development Workflow
1. **Always prefer editing existing files** over creating new ones
2. **Never create documentation files** unless explicitly requested
3. **Test thoroughly**: Run both backend pytest and frontend E2E tests
4. **Commit only when requested**: Use descriptive commit messages with Claude signature

## API Integration & Standards

### Endpoints
- **Backend**: `http://localhost:8000/api/*`
- **Corpus**: `http://localhost:8000/api/corpus/*` (proxied to port 8001)
- **WebSocket**: `ws://localhost:8000/api/ws/conversations/{id}`
- **Auth**: JWT Bearer tokens in Authorization header

### Code Quality Standards
- **TypeScript**: Maintain strict typing with >95% coverage
- **Testing**: Comprehensive backend (pytest) and frontend (Playwright) test suites
- **UI Components**: Use shadcn/ui with Tailwind CSS design system
- **Responsive Design**: Mobile-first approach with accessibility considerations
- **Error Handling**: Consistent API responses with proper HTTP status codes

## Testing & Quality Assurance

### Test Infrastructure
- **Backend**: 240+ pytest tests covering API endpoints, authentication, and curation system
- **Frontend**: Comprehensive Playwright E2E tests for all major workflows
- **Environment**: Automatic database configuration for testing vs production
- **CI/CD**: Tests run on commits with proper failure reporting

### Running Tests
```bash
# Backend tests
cd backend && uv run python -m pytest                    # All tests
cd backend && uv run python -m pytest tests/test_curation_api.py -v  # Specific tests

# Frontend E2E tests  
cd frontend && pnpm test                                  # Unit tests
cd frontend && pnpm exec playwright test                 # E2E tests
cd frontend && pnpm exec playwright test --headed       # Visual debugging
```

### Key Test Coverage
- **Authentication**: Login/logout, JWT validation, protected routes
- **Conversations**: Creation, editing, archiving, WebSocket messaging
- **Curation**: Saved conversations, collections, filtering, pagination
- **Search**: Semantic search, discovery feed, real-time results
- **UI/UX**: Responsive design, accessibility, error handling

## Development & Debugging Tools

### Built-in Debugging
- **API Logger** (`useApiLogger`): Auto-logs all requests/responses in development
- **Debug Panel**: Real-time state visibility (bottom-right corner)
- **Enhanced Errors**: Context-aware error displays with retry functionality
- **Auto-login**: Set `VITE_AUTO_LOGIN=true` for development automation

## Deployment & Production

### Environment Configuration
- **Database**: PostgreSQL with environment-aware configuration
- **Environment Variables**: 
  - `DATABASE_URL`: PostgreSQL connection string
  - `VITE_AUTO_LOGIN`: Development auto-login (set to `true` for testing)
  - `TESTING`: Set to `1` to override DATABASE_URL requirement in tests
- **Health Monitoring**: `/api/health` endpoint for Railway deployment monitoring

### Production Deployment
- **Backend**: Railway deployment with automatic health checks
- **Frontend**: Vite build with optimized production assets
- **Database**: PostgreSQL with proper connection pooling
- **Vector Search**: ChromaDB with persistent storage

## Troubleshooting

### Common Issues
1. **Database Connection Errors**
   - Verify `DATABASE_URL` is set correctly
   - For tests, ensure `TESTING=1` environment variable
   - Check PostgreSQL service is running

2. **WebSocket Connection Issues**
   - Verify backend is running on port 8000
   - Check Vite proxy configuration in `vite.config.ts`
   - Ensure WebSocket URL format: `ws://localhost:8000/api/ws/conversations/{id}`

3. **Authentication Problems**
   - Clear browser localStorage and try again
   - Verify JWT token format and expiration
   - Check that auto-login is properly configured for development

4. **Test Failures**
   - Backend: Ensure test database is properly seeded
   - Frontend: Check that both backend and frontend servers are running
   - E2E: Verify Playwright browsers are installed (`pnpm exec playwright install`)

5. **HN Recommendations Issues**
   - **Empty recommendations**: Set `MOCK_HN_RECOMMENDATIONS=true` to use mock data for testing
   - **Corpus service down**: Mock flag provides fallback recommendations when corpus service is unavailable
   - **Testing**: Mock recommendations are contextual and adapt to conversation summary content

### Performance Considerations
- **Vector Search**: ChromaDB operations are async and may take time with large datasets
- **WebSocket**: Message deduplication prevents duplicate AI responses
- **Database**: Use proper indexing for conversation and user queries
- **Frontend**: TanStack Query provides automatic caching for API responses

## Project Status
VectorSpace is a **production-ready** conversation discovery platform with complete backend API, responsive frontend, comprehensive testing, and deployment infrastructure.