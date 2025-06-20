# Local Development Setup with PostgreSQL

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
uv sync

# Frontend  
cd ../frontend
pnpm install
```

### 2. Start PostgreSQL

```bash
# Start PostgreSQL with Docker Compose
docker-compose -f docker-compose.dev.yml up postgres -d

# Optional: Start pgAdmin for database management
docker-compose -f docker-compose.dev.yml --profile tools up -d
```

### 3. Set Environment Variables

```bash
# Copy local environment template
cp .env.local .env

# Edit .env and set your OpenAI API key
OPENAI_API_KEY=sk-your-key-here
```

### 4. Initialize Database

```bash
cd backend

# The app will auto-create tables on startup
# Optional: Seed with test data
uv run python seed_database.py
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
uv run python main.py

# Terminal 2: Frontend  
cd frontend
pnpm run dev
```

### 6. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (admin/admin)

## Database Management

### Connect to PostgreSQL

```bash
# Using psql (if installed locally)
psql postgresql://vectorspace:vectorspace@localhost:5432/vectorspace

# Using Docker
docker exec -it vectorspace-postgres-dev psql -U vectorspace -d vectorspace

# Using pgAdmin
# Go to http://localhost:5050, login with admin/admin
# Add server: Host=postgres, Username=vectorspace, Password=vectorspace
```

### Database Commands

```bash
# Stop database
docker-compose -f docker-compose.dev.yml down

# Reset database (delete all data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up postgres -d

# View logs
docker-compose -f docker-compose.dev.yml logs postgres

# Backup database
docker exec vectorspace-postgres-dev pg_dump -U vectorspace vectorspace > backup.sql

# Restore database
docker exec -i vectorspace-postgres-dev psql -U vectorspace vectorspace < backup.sql
```

## Environment Variables

### Local Development (.env)
```bash
# PostgreSQL for local development
DATABASE_URL=postgresql+asyncpg://vectorspace:vectorspace@localhost:5432/vectorspace

# Your actual API key
OPENAI_API_KEY=sk-your-openai-key-here

# Generated JWT secret
JWT_SECRET_KEY=your-local-jwt-secret-key

# Development settings
ENVIRONMENT=development
DEBUG=true
```

### Railway Production
```bash
# Railway PostgreSQL (auto-injected)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Set in Railway dashboard
OPENAI_API_KEY=sk-your-production-key
JWT_SECRET_KEY=generated-secure-key
ENVIRONMENT=production
```

## Testing

```bash
# Backend tests (with test database)
cd backend
TESTING=true uv run python -m pytest

# Frontend tests
cd frontend
pnpm test

# E2E tests (requires both servers running)
cd frontend
pnpm run test:e2e
```

## Production vs Development

| Feature | Local Dev | Railway Prod |
|---------|-----------|-------------|
| **Database** | Docker PostgreSQL | Railway PostgreSQL |
| **API URL** | localhost:8000 | your-backend.railway.app |
| **Frontend** | Vite dev server | Static build served by backend |
| **Environment** | .env file | Railway dashboard |
| **Logs** | Console output | Railway dashboard |
| **Storage** | Local volumes | Railway persistent volumes |

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connectivity
nc -zv localhost 5432

# View PostgreSQL logs
docker logs vectorspace-postgres-dev
```

### Backend Issues
```bash
# Check dependencies
cd backend && uv tree

# Test database connection
cd backend && uv run python -c "from app.database import engine; print('DB connected')"
```

### Frontend Issues
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

This setup gives you **full PostgreSQL compatibility** between development and production! 🐘