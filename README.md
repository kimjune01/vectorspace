# VectorSpace 🚀

**A conversation discovery platform where users share AI chatbot conversations publicly, discover interesting conversations from others, and build profiles showcasing their AI interactions.**

## 🎯 Core Vision

VectorSpace transforms AI conversations into a social discovery experience:

- **💬 AI Conversation Sharing**: Chat with AI and conversations are public by default
- **🔍 Semantic Discovery**: Browse and search conversations by topic and content  
- **👤 Social Profiles**: User profiles showcasing conversation history and expertise
- **⚡ Real-time Chat**: WebSocket-powered AI interactions with streaming responses

## 🏗️ Architecture

### Backend (FastAPI + Python)
- **Complete** ✅ Full-featured conversation discovery API
- **Authentication** ✅ JWT-based auth with non-expiring tokens
- **AI Integration** ✅ WebSocket chat with streaming responses (mock AI service)
- **Vector Search** ✅ ChromaDB semantic search across conversations
- **Profile System** ✅ User profiles with base64 thumbnail images
- **Auto-Processing** ✅ Conversation summarization and archiving
- **Testing** ✅ 70+ comprehensive tests

### Frontend (React + TypeScript)
- **In Development** 🚧 Vite + React + shadcn/ui components
- **Design System** 📋 Adapting T3 cloneathon components
- **State Management** 📋 TanStack Query + Zustand
- **Real-time UI** 📋 WebSocket integration for live chat

## 🚀 Quick Start

### Prerequisites
- **Python 3.12+** with `uv` package manager
- **Node.js 18+** with `pnpm` package manager

### Backend Setup
```bash
# Install dependencies and setup environment
cd backend
uv sync

# Create .env file with your configuration
cp .env.example .env  # Edit with your settings

# Start the FastAPI backend
uv run uvicorn app.main:app --reload

# Backend runs on http://localhost:8000
# API docs available at http://localhost:8000/docs
```

### Frontend Setup  
```bash
# Setup the React frontend (currently in development)
cd frontend
pnpm install
pnpm run dev

# Frontend runs on http://localhost:5173
```

### Testing
```bash
# Run backend tests (blazing fast ~2 seconds!)
cd backend
uv run python -m pytest

# Run with coverage
uv run python -m pytest --cov=app

# Run specific test module
uv run python -m pytest tests/test_auth.py -v

# 187 tests covering all features ✅
```

### Test Performance Optimizations
Our test suite is optimized for speed:
- **Mocked heavy dependencies** (sentence-transformers ML models)
- **In-memory databases** (SQLite + ChromaDB)
- **Session-scoped fixtures** for database engine
- **Optimized test isolation** with table cleanup
- **No artificial delays** in test mode

Result: **60x faster** - from 2+ minutes down to ~2 seconds! ⚡

## ⚙️ Configuration

### Environment Variables (.env)
```bash
# OpenAI API (optional - falls back to mock if not provided)
OPENAI_API_KEY=your-openai-api-key-here
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.7

# Database
DATABASE_URL=sqlite+aiosqlite:///./conversations.db

# JWT Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key-here
JWT_ALGORITHM=HS256

# ChromaDB Vector Database
CHROMA_DB_PATH=./chroma_db

# Development Settings
DEBUG=True
ENVIRONMENT=development
LOG_LEVEL=INFO

# CORS (for frontend)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## 📡 API Features

### 🔐 Authentication
- `POST /api/auth/signup` - Create account with email/username/display_name
- `POST /api/auth/login` - Login with non-expiring JWT token
- `POST /api/auth/logout` - Invalidate JWT token

### 💬 Conversations
- `POST /api/conversations` - Start new AI conversation
- `GET /api/conversations/{id}` - Get conversation details
- `WS /api/ws/conversations/{id}` - WebSocket for real-time chat

### 🔍 Discovery
- `POST /api/search` - Semantic search (20/page, anonymous first page only)
- `GET /api/discover` - Browse recent conversations
- `GET /api/similar/{id}` - Find similar conversations

### 👤 User Profiles
- `GET /api/users/profile/{username}` - Public user profile
- `PUT /api/users/me/profile` - Update bio and display name
- `POST /api/users/me/profile-image` - Upload profile image (base64 thumbnails)

## 🎨 UI Preview

The frontend will feature:
- **Discovery Feed**: Social media-style feed of recent conversations
- **Semantic Search**: Find conversations about specific topics
- **Chat Interface**: Real-time AI conversation with streaming responses
- **Profile Showcase**: User profiles displaying conversation history
- **Mobile-Responsive**: Modern, accessible design adapted from T3 cloneathon

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern async web framework with automatic API docs
- **SQLAlchemy 2.0** - Async ORM with SQLite database
- **ChromaDB** - Vector database for semantic search  
- **WebSockets** - Real-time bidirectional communication
- **OpenAI API** - AI chat integration (configurable)
- **pytest + pytest-asyncio** - Comprehensive async testing
- **python-jose** - JWT authentication
- **passlib + bcrypt** - Secure password hashing

### Frontend (In Development)
- **Vite + React** - Fast development and optimized builds
- **TypeScript** - Full type safety
- **shadcn/ui** - Modern component library (adapted from T3 project)
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management
- **Zustand** - Client state management

## 📈 Current Status

### ✅ **Backend Complete**
- All core features implemented and tested (187 tests)
- Ready for production deployment
- OpenAI API integration (falls back to mock if no API key)
- Test suite optimized to run in ~2 seconds
- Performance optimizations for database operations

### 🚧 **Frontend In Development**  
- **Phase 1**: Foundation & Component Library (Current)
- **Phase 2**: Authentication & API Integration
- **Phase 3**: Discovery Feed & Search
- **Phase 4**: AI Chat Interface  
- **Phase 5**: User Profiles & Polish

## 🤝 Contributing

This project follows TDD practices with comprehensive test coverage. See `CLAUDE.md` for detailed development guidelines and architecture documentation.

## 📄 License

[Add your license here]

---

**VectorSpace: Where AI conversations become discoverable knowledge** 🌟
