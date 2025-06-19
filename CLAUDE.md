# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VectorSpace** is a conversation discovery platform where users share AI chatbot conversations publicly, discover interesting conversations from others, and build profiles showcasing their AI interactions.

### Core Vision
- **AI Conversation Sharing**: Users chat with AI and conversations are public by default
- **Semantic Discovery**: Browse and search conversations by topic and content
- **Social Profiles**: User profiles showcasing conversation history and expertise
- **Real-time Chat**: WebSocket-powered AI interactions with streaming responses

## Architecture

### Backend (`/backend/backend/`)
- **Framework**: FastAPI (async Python)
- **Database**: SQLite with SQLAlchemy (async ORM)
- **Vector Search**: ChromaDB for semantic conversation discovery
- **Authentication**: JWT tokens with non-expiring sessions
- **Real-time**: WebSocket for AI chat and user messaging
- **AI Integration**: Mock AI service (production ready for OpenAI/Anthropic)

### Frontend (`/frontend/`)
- **Framework**: Vite + React + TypeScript
- **UI Components**: shadcn/ui (adapted from T3 cloneathon project)
- **Styling**: Tailwind CSS with comprehensive design system
- **Routing**: React Router (SPA)
- **State Management**: TanStack Query + Zustand
- **Authentication**: JWT with auth context

## Development Setup

### Project Initialization
- **Python Backend**: Use `uv` for dependency management
- **React Frontend**: Use Vite as build tool and dev server
- **Package Management**: Use `pnpm` instead of `npm` for all Node.js projects
- **Version Control**: Git for all changes

### Development Commands

#### Backend
```bash
cd backend/backend
uv run python main.py          # Start FastAPI server (port 8000)
uv run python -m pytest       # Run all tests
uv run python -m pytest tests/test_profile_images.py -v  # Run specific tests
```

#### Frontend
```bash
cd frontend
pnpm install                   # Install dependencies
pnpm run dev                   # Start Vite dev server (port 5173)
pnpm run build                 # Build for production
pnpm run preview               # Preview production build
```

## Development Guidelines

### Version Control
- Use git for all version control
- Non-destructive git commands (status, log, diff, etc.) can be executed without approval
- Always commit changes only when explicitly requested

### File Management
- Always prefer editing existing files over creating new ones
- Never create documentation files (*.md) unless explicitly requested
- Do not create README files unless specifically asked

### Component Reuse Strategy
- **T3 Components**: Reuse 70%+ of components from `/t3-cloneathon-jules_wip_4736255235786321083/`
- **UI Library**: Copy entire shadcn/ui component library
- **Adaptation**: Modify T3 chat interface for conversation discovery
- **Design System**: Use T3's Tailwind configuration and CSS variables

### API Integration
- **Backend URLs**: `http://localhost:8000/api/*`
- **Authentication**: JWT Bearer tokens in Authorization header
- **WebSocket**: `ws://localhost:8000/api/ws/conversations/{id}`
- **Error Handling**: Consistent error responses with proper HTTP status codes

### Code Quality
- **TypeScript**: Maintain >95% TypeScript coverage
- **Testing**: Comprehensive test coverage for both backend and frontend
- **Responsive Design**: Mobile-first approach with T3's responsive patterns
- **Accessibility**: Follow T3's accessible component patterns

## Key Features Implemented

### Backend Features ✅
- [x] User authentication (signup, login, logout, JWT)
- [x] Conversation management (create, archive, visibility controls)
- [x] AI chatbot integration with OpenAI API streaming responses
- [x] Semantic search with ChromaDB vector embeddings
- [x] User profiles with base64 profile images
- [x] PII filtering for public conversation summaries
- [x] Auto-summarization at 1500+ tokens
- [x] Auto-archiving after 24h inactivity
- [x] WebSocket for real-time chat
- [x] Background task processing
- [x] Comprehensive test suite (187 tests, ~2s runtime)
- [x] Production-ready performance optimizations

### Frontend Features ✅
- [x] Component library migration from T3 project (shadcn/ui components)
- [x] Authentication UI (login/register forms with validation)
- [x] Conversation discovery feed with pagination
- [x] Semantic search interface with real-time results
- [x] AI chat interface with WebSocket integration and streaming
- [x] User profile pages with image upload and editing
- [x] Responsive design and mobile support
- [x] Protected routes and authentication context
- [x] Modern UI with Tailwind CSS design system
- [x] State management with TanStack Query and Zustand

## Project Status

**All Features Complete** ✅

VectorSpace is now a fully functional conversation discovery platform with:
- Complete backend API (187+ tests, production-ready)
- Complete frontend application (React + TypeScript)
- Real-time chat with WebSocket integration
- Semantic search and conversation discovery
- User authentication and profile management
- Responsive design for all screen sizes