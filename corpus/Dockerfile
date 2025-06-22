# Corpus Service Dockerfile
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY app/ ./app/
COPY main.py ./
COPY start.sh ./

# Make startup script executable
RUN chmod +x start.sh

# Create directory for ChromaDB
RUN mkdir -p /app/chroma_db

# Expose port (Railway will set the PORT environment variable)
EXPOSE 8001

# Health check (use PORT if set, fallback to 8001)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

# Run the application
CMD ["./start.sh"]