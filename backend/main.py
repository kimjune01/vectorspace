#!/usr/bin/env python
"""
Main entry point for VectorSpace backend
"""
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

if __name__ == "__main__":
    import uvicorn
    from app.main import app
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("ENVIRONMENT", "development") == "development"
    
    print(f"🚀 Starting VectorSpace on {host}:{port}")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
    )