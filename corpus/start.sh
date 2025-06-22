#!/bin/bash

# Corpus service startup script for Railway deployment

echo "Starting Corpus service..."

# Set default port if not provided
export CORPUS_PORT=${PORT:-8001}

# Set production configuration
export DEBUG=false
export LOG_LEVEL=INFO
export HOST=0.0.0.0

# Create ChromaDB directory if it doesn't exist
mkdir -p /app/chroma_db

# Start the service
echo "Starting Corpus service on port $CORPUS_PORT"
source .venv/bin/activate && python main.py