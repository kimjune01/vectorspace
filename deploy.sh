#!/bin/bash
# Railway deployment script

echo "🚀 Deploying VectorSpace to Railway..."

# Check if logged in
railway whoami || { echo "Please run: railway login"; exit 1; }

echo "📦 Next steps:"
echo "1. Go to: https://railway.com/project/f7a12b31-7178-453f-8bfc-873b8dc7811b"
echo "2. Click 'New Service' → 'GitHub Repo'"
echo "3. Connect your GitHub account and select your repo"
echo "4. Railway will auto-detect railway.toml and deploy"
echo ""
echo "⚙️  Then set these environment variables in Railway dashboard:"
echo "   - OPENAI_API_KEY = your-openai-key"
echo "   - JWT_SECRET_KEY = $(openssl rand -base64 32)"
echo "   - ENVIRONMENT = production"
echo ""
echo "🔗 Your project: https://railway.com/project/f7a12b31-7178-453f-8bfc-873b8dc7811b"