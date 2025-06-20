#!/usr/bin/env python3
"""
Database migration script for VectorSpace backend.
Run this to initialize or update the database schema.
"""
import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import init_database, check_database_connection

async def main():
    """Run database migrations."""
    print("🔄 Starting database migration...")
    
    # Check connection first
    if not await check_database_connection():
        print("❌ Database connection failed")
        print("   Check your DATABASE_URL environment variable")
        sys.exit(1)
    
    print("✅ Database connection successful")
    
    # Run migrations
    try:
        await init_database()
        print("✅ Database migration completed successfully")
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())