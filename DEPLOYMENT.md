# VectorSpace Railway Deployment - Quick Start

Deploy VectorSpace on Railway Hobby plan for $5/month with PostgreSQL included.

## 5-Minute Deploy

### 1. Sign Up & Install CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login (opens browser)
railway login
```

### 2. Deploy from GitHub

```bash
# Clone and enter directory
git clone https://github.com/your-username/vectorspace.git
cd vectorspace

# Initialize Railway project
railway init vectorspace

# Link to GitHub repo
railway link

# Deploy
railway up
```

### 3. Add Database & Set API Key

```bash
# Add PostgreSQL (included in $5)
railway add postgresql

# Set your OpenAI key
railway variables set OPENAI_API_KEY=sk-your-key-here

# Deploy with variables
railway up
```

### 4. Access Your App

```bash
# Get your app URL
railway open

# View logs
railway logs -f
```

## What You Get for $5/month

✅ **Included:**
- Always-on backend (no cold starts)
- PostgreSQL database
- Persistent storage volumes  
- Custom domain support
- Automatic HTTPS/SSL
- GitHub auto-deploys
- 8GB RAM, 8 vCPU shared
- Logs & monitoring
- **Optimized Docker builds** (60-80% smaller than Nixpacks)

❌ **Not Included:**
- Separate frontend hosting (backend serves both)
- Multiple environments (need multiple projects)

## Docker vs Nixpacks

The backend now uses Docker by default for Railway deployments:

| Feature | Nixpacks | Docker |
|---------|----------|--------|
| Image Size | 800MB-1.3GB | 200-500MB |
| Build Time | 55 seconds | 15-25 seconds |
| Deploy Time | 32 seconds | 5-10 seconds |
| Total Time | 1m 27s | 20-35s |

This means faster deployments and more efficient resource usage within your $5 plan!

## Monorepo Setup (Recommended)

Since you're on a budget, serve both frontend and backend from one Railway service:

```python
# backend/main.py - Add static file serving
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# API routes
app.include_router(api_router, prefix="/api")

# Serve frontend build
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="frontend")
```

### Build Script

```bash
#!/bin/bash
# railway-build.sh

# Build frontend
cd frontend
npm install -g pnpm
pnpm install
pnpm run build
cp -r dist ../backend/static

# Setup backend
cd ../backend
pip install uv
uv sync
```

Update `railway.toml`:
```toml
[build]
buildCommand = "chmod +x railway-build.sh && ./railway-build.sh"
```

## Environment Variables

Set these in Railway dashboard or CLI:

```bash
# Required
railway variables set OPENAI_API_KEY=sk-xxx
railway variables set JWT_SECRET_KEY=$(openssl rand -base64 32)

# Optional
railway variables set ENVIRONMENT=production
railway variables set LOG_LEVEL=INFO
```

## Database Management

```bash
# Connect to PostgreSQL
railway connect postgresql

# Run migrations/seed
railway run python backend/seed_database.py

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql
```

## Monitoring & Maintenance

### Check Usage
```bash
# View current month usage
railway usage

# Should stay under $5 for small apps
```

### Optimization Tips
1. **Disable debug logging**: Reduces resource usage
2. **Use connection pooling**: For database efficiency
3. **Cache static assets**: Reduce bandwidth
4. **Optimize images**: Before uploading

## Scaling Options

When you grow:
- **$20/month Pro**: More resources, team features
- **Multiple services**: Separate frontend/backend
- **Add Redis**: For caching ($5 addon)
- **Multiple regions**: For global deployment

## Troubleshooting

### High Usage?
```bash
# Check what's using resources
railway logs --filter error
railway metrics
```

### Database Full?
```bash
# Check size
railway run psql $DATABASE_URL -c "SELECT pg_database_size('postgres');"

# Clean old data
railway run python -c "from app import cleanup_old_conversations; cleanup_old_conversations()"
```

## Quick Commands

```bash
# Deploy
railway up

# Restart
railway restart

# Environment
railway variables
railway run [command]

# Logs
railway logs -f
railway logs --filter error

# Database
railway connect postgresql
railway backup:create
```

## Total Monthly Cost: $5

- Railway Hobby: $5 (includes $5 usage credit)
- PostgreSQL: Included
- Storage: Included
- Bandwidth: ~100GB included

Perfect for personal projects and small communities! 🚂