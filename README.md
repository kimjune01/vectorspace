# VectorSpace 🚀

**A conversation discovery platform where users share AI chatbot conversations publicly, discover interesting conversations from others, and build profiles showcasing their AI interactions.**

## 🎯 Core Vision

VectorSpace transforms AI conversations into a social discovery experience:

- **💬 AI Conversation Sharing**: Chat with AI and conversations are public by default
- **🔍 Semantic Discovery**: Browse and search conversations by topic and content  
- **👤 Social Profiles**: User profiles showcasing conversation history and expertise
- **⚡ Real-time Chat**: WebSocket-powered AI interactions with streaming responses

## 🏗️ Architecture

### Backend (FastAPI + Python) ✅ Complete
- **Full-featured API** with conversation discovery, semantic search, and user profiles
- **JWT Authentication** with non-expiring tokens and secure logout
- **AI Integration** with WebSocket chat and streaming responses
- **Vector Search** powered by ChromaDB with semantic embeddings
- **Auto-Processing** including summarization, archiving, and PII filtering
- **Comprehensive Testing** with 187+ tests running in ~2 seconds

### Frontend (React + TypeScript) ✅ Complete
- **Modern Stack** using Vite + React + TypeScript with shadcn/ui components
- **Full Authentication** with login/register flows and protected routes
- **Conversation Discovery** with semantic search and browsing feeds
- **Real-time Chat** with WebSocket integration and streaming AI responses
- **User Profiles** with customizable bios, images, and conversation history
- **Responsive Design** optimized for both desktop and mobile

## 🚀 Quick Start

### Prerequisites
- **Python 3.12+** with `uv` package manager
- **Node.js 18+** with `pnpm` package manager

### Backend Setup
```bash
# Install dependencies and start backend
cd backend/backend
uv sync
uv run python main.py

# Backend runs on http://localhost:8000
# API docs available at http://localhost:8000/docs
```

### Frontend Setup  
```bash
# Install dependencies and start frontend
cd frontend
pnpm install
pnpm run dev

# Frontend runs on http://localhost:5173
```

### Testing
```bash
# Run backend tests (187 tests in ~2 seconds!)
cd backend/backend
uv run python -m pytest

# Run with coverage
uv run python -m pytest --cov=app

# Run frontend tests
cd frontend
pnpm run test
```

## ⚙️ Configuration

The application works out of the box with default settings. For production, configure:

### Environment Variables (Optional)
```bash
# AI Integration (optional - uses mock AI by default)
OPENAI_API_KEY=your-openai-api-key-here

# JWT Secret (auto-generated if not provided)
JWT_SECRET_KEY=your-super-secret-jwt-key-here

# Database (SQLite by default)
DATABASE_URL=sqlite+aiosqlite:///./conversations.db
```

## ✨ Key Features

### 🔐 Authentication & Security
- Secure JWT-based authentication with non-expiring tokens
- Account creation with email validation
- Secure logout with token blacklisting
- PII filtering for public conversation summaries

### 💬 AI Conversations
- Real-time AI chat with streaming responses
- WebSocket-powered bidirectional communication
- Automatic conversation summarization and archiving
- Support for multiple AI providers (OpenAI integration ready)

### 🔍 Discovery & Search
- Semantic search across all public conversations
- ChromaDB vector embeddings for intelligent content matching
- Browse recent conversations feed
- Find similar conversations based on content

### 👤 User Profiles & Social
- Customizable user profiles with bios and images
- Public conversation history showcasing
- Privacy controls for conversation visibility
- User statistics and activity tracking

## 🛠️ Technology Stack

### Backend (FastAPI + Python)
- **FastAPI** - Modern async web framework with automatic API docs
- **SQLAlchemy 2.0** - Async ORM with SQLite database
- **ChromaDB** - Vector database for semantic search  
- **WebSockets** - Real-time bidirectional communication
- **OpenAI API** - AI chat integration (configurable)
- **pytest** - Comprehensive testing framework (187+ tests)

### Frontend (React + TypeScript)
- **Vite + React** - Fast development and optimized builds
- **TypeScript** - Full type safety throughout
- **shadcn/ui** - Modern component library
- **Tailwind CSS** - Utility-first styling with design system
- **TanStack Query** - Server state management
- **React Router** - Client-side routing

## 🚀 Project Status

**VectorSpace is now feature-complete** with both backend and frontend fully implemented!

### ✅ Backend Features
- Complete conversation discovery API with 187+ tests
- JWT authentication with secure logout
- Real-time WebSocket chat with AI streaming
- Semantic search powered by ChromaDB
- User profiles with image upload support
- Automated summarization and archiving

### ✅ Frontend Features  
- Modern React + TypeScript application
- Complete authentication flows (login/register)
- Conversation discovery with semantic search
- Real-time chat interface with WebSocket integration
- User profiles with customizable bios and images
- Fully responsive design for mobile and desktop

## 🤝 Contributing

This project demonstrates production-ready architecture with comprehensive testing and modern development practices. Both backend and frontend are ready for deployment and further development.

---

**VectorSpace: Where AI conversations become discoverable knowledge** 🌟
