# Frontend ↔ Backend Connection Guide

## 🔗 Connecting to Railway Backend

### Option 1: Update Environment File (Recommended)
1. Edit `frontend/.env`:
   ```bash
   # Change this line:
   VITE_API_URL=http://localhost:8000
   
   # To your Railway backend URL:
   VITE_API_URL=https://bountiful-wholeness-production-eedc.up.railway.app
   ```

2. Restart your development server:
   ```bash
   cd frontend
   pnpm run dev
   ```

### Option 2: Set Environment Variable
```bash
cd frontend
VITE_API_URL=https://bountiful-wholeness-production-eedc.up.railway.app pnpm run dev
```

### Option 3: Build for Production
```bash
cd frontend
pnpm run build
pnpm run preview
```
This uses `.env.production` which already has your Railway URL.

## 🚀 Deployment Options

### Deploy Frontend to Railway (Recommended)
1. Add frontend as a separate service in Railway
2. Railway will automatically detect it's a Node.js project
3. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

### Deploy Frontend to Vercel/Netlify
1. Connect your GitHub repo
2. Set build command: `cd frontend && pnpm run build`
3. Set output directory: `frontend/dist`
4. Add environment variable: `VITE_API_URL=https://your-backend.railway.app`

## 🔧 Testing Connection

1. **Start frontend** with Railway backend URL
2. **Open browser** to `http://localhost:5173`
3. **Check Network tab** - API calls should go to Railway
4. **Test login** - should work with Railway database

## 🐛 Troubleshooting

### CORS Issues
If you get CORS errors, the backend needs to allow your frontend domain:
```python
# In backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Connection Refused
- Check backend is running: `https://your-backend.railway.app/health`
- Check environment variable is set correctly
- Check no trailing slashes in URLs

### WebSocket Issues
WebSocket connections will automatically use the same base URL:
```javascript
// This will connect to Railway if VITE_API_URL is set to Railway
const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${API_HOST}/api/ws/conversations/${id}`
```

## 📱 Current Configuration

- **Local Development**: Uses Vite proxy to forward `/api` calls
- **Production Build**: Uses environment variable to set API base URL
- **Railway Hosts**: Automatically allowed in `vite.config.ts`