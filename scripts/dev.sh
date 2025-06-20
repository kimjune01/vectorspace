#!/bin/bash
# Development startup script

set -e

echo "🚀 Starting VectorSpace local development..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.local .env
    echo "⚠️  Please edit .env and set your OPENAI_API_KEY"
fi

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
docker-compose -f docker-compose.dev.yml up postgres -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout 30 bash -c 'until docker exec vectorspace-postgres-dev pg_isready -U vectorspace; do sleep 1; done'

# Install backend dependencies
echo "🐍 Installing backend dependencies..."
cd backend
uv sync --dev
cd ..

# Install frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd frontend
pnpm install
cd ..

echo ""
echo "✅ Setup complete! Now run:"
echo ""
echo "Terminal 1: cd backend && uv run python main.py"
echo "Terminal 2: cd frontend && pnpm run dev"
echo ""
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:8000"
echo "📊 pgAdmin: http://localhost:5050 (admin/admin)"
echo ""
echo "To stop PostgreSQL: docker-compose -f docker-compose.dev.yml down"