"""Corpus service entry point."""

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    # Railway uses PORT, fallback to CORPUS_PORT for local development
    port = int(os.getenv("PORT") or os.getenv("CORPUS_PORT", "8001"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    print(f"Starting Corpus service on {host}:{port}")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )