# Frontend Railway Deployment Guide

## 🚀 Deploying Frontend to Railway

### Step 1: Add Frontend Service
1. Go to your **Railway Dashboard**
2. Click your **VectorSpace project**
3. Click **"+ New Service"**
4. Choose **"GitHub Repo"**
5. Select your repository and **set Root Directory to `/frontend`**

### Step 2: Configure Environment Variables
In the frontend service settings → Variables:
```
VITE_API_URL=https://vectorspace-production.up.railway.app
NODE_ENV=production
```

### Step 3: Deploy
Railway will automatically:
1. Detect it's a Node.js/Vite project
2. Run `pnpm install && pnpm run build`
3. Start with `pnpm run preview --host 0.0.0.0 --port $PORT`
4. Generate a frontend URL like `https://your-frontend.railway.app`

## 📋 Configuration Files

### `railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm run build"

[deploy]
startCommand = "pnpm run preview --host 0.0.0.0 --port $PORT"
healthcheckPath = "/"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[environment]
NODE_ENV = "production"
VITE_API_URL = "https://vectorspace-production.up.railway.app"
```

### Updated API Configuration
The frontend automatically detects environment:
- **Development**: Uses `/api` proxy (via Vite dev server)
- **Production**: Uses `VITE_API_URL/api` (direct to Railway backend)

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend Railway URL | ✅ Yes |
| `NODE_ENV` | Set to "production" | Auto-set |

## 🌐 Full Stack Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │    │  Backend        │    │  PostgreSQL     │
│  Railway        │───▶│  Railway        │───▶│  Railway        │
│  (React/Vite)   │    │  (FastAPI)      │    │  (Database)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ✅ Verification Steps

1. **Frontend Health**: Visit `https://your-frontend.railway.app`
2. **Backend Health**: Visit `https://your-backend.railway.app/health`
3. **API Connection**: Try logging in from frontend
4. **WebSocket**: Test real-time chat functionality

## 🐛 Troubleshooting

### Build Failures
- Check `pnpm install` runs successfully
- Verify all dependencies are in `package.json`
- Check TypeScript compilation errors

### Runtime Issues
- Verify `VITE_API_URL` is set correctly
- Check CORS configuration in backend
- Test backend health endpoint

### CORS Errors
Update backend CORS settings to include frontend domain:
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-frontend.railway.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🎯 Benefits of Railway Frontend Deployment

✅ **Automatic builds** from GitHub pushes  
✅ **Same platform** as backend (simplified management)  
✅ **Custom domains** available  
✅ **SSL certificates** automatically provisioned  
✅ **Environment variables** management  
✅ **Logs and monitoring** in same dashboard  

## 💰 Cost Considerations

- Frontend typically uses minimal resources
- Both services fit within Railway's $5 hobby plan
- Static assets served efficiently
- No additional database needed for frontend

Your frontend will be live at `https://your-frontend.railway.app` and automatically connect to the PostgreSQL backend! 🎉