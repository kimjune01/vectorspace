# VectorSpace Railway Deployment - Two Services

Deploy frontend and backend as **separate Railway services** for better scalability and Railway's recommended approach.

## Cost: Still $5/month Total

- Backend service: ~$3/month
- Frontend service: ~$2/month  
- PostgreSQL: Included in usage
- **Total: $5/month** (same cost, better architecture)

## Deployment Steps

### 1. Create Backend Service

In Railway dashboard:
1. **New Service** → **GitHub Repo** 
2. **Root Directory**: `backend`
3. Railway auto-detects Python and uses `backend/railway.toml`
4. **Environment Variables**:
   ```
   OPENAI_API_KEY = your-key-here
   JWT_SECRET_KEY = your-jwt-secret
   ENVIRONMENT = production
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```

### 2. Create Frontend Service  

In Railway dashboard:
1. **New Service** → **GitHub Repo** (same repo)
2. **Root Directory**: `frontend` 
3. Railway auto-detects Node.js and uses `frontend/railway.toml`
4. **Environment Variables**:
   ```
   VITE_API_BASE_URL = https://your-backend-url.railway.app
   VITE_WS_URL = wss://your-backend-url.railway.app
   ```

### 3. Add Database

1. **Add Database** → **PostgreSQL**
2. Database URL automatically available to backend as `${{Postgres.DATABASE_URL}}`

## Advantages of Separate Services

✅ **Railway's recommended approach**  
✅ **Independent scaling** (scale frontend/backend separately)  
✅ **Faster builds** (only rebuilds what changed)  
✅ **Better monitoring** (separate logs/metrics)  
✅ **Easier debugging** (isolate issues)  
✅ **Same total cost** ($5/month)

## Auto-Deploy Setup

Both services will auto-deploy when you push to GitHub:
- Backend changes → only backend rebuilds
- Frontend changes → only frontend rebuilds  
- Much faster than monorepo builds!

## Quick Commands

```bash
# Backend logs
railway logs --service vectorspace-backend

# Frontend logs  
railway logs --service vectorspace-frontend

# Connect to database
railway connect postgresql

# Deploy specific service
railway up --service vectorspace-backend
```

This is Railway's **recommended pattern** for full-stack apps in 2025! 🚂