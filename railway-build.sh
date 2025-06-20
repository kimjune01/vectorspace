#!/bin/bash
# Railway build script for monorepo deployment

set -e  # Exit on error

echo "🚀 Starting VectorSpace build..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install -g pnpm
pnpm install --frozen-lockfile
VITE_API_BASE_URL=/api VITE_WS_URL=/api/ws pnpm run build

# Copy frontend build to backend
echo "📁 Copying frontend build to backend..."
rm -rf ../backend/static
cp -r dist ../backend/static

# Setup backend
echo "🐍 Setting up backend..."
cd ../backend
pip install uv
uv sync --frozen

# Create necessary directories
mkdir -p chroma_db
mkdir -p uploads

echo "✅ Build complete!"