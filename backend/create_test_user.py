import asyncio
import sys
import os
sys.path.append(os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models import User

DATABASE_URL = "sqlite+aiosqlite:///./vectorspace.db"

async def create_test_user():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        # Check if user exists
        result = await session.execute(
            select(User).where(User.username == "testuser")
        )
        if result.scalar_one_or_none():
            print("Test user already exists")
            return
        
        # Create test user
        user = User(
            username="testuser",
            email="testuser@example.com",
            display_name="Test User",
            bio="Test user for automated testing"
        )
        user.set_password("password123")
        session.add(user)
        await session.commit()
        print("Test user created successfully")

if __name__ == "__main__":
    asyncio.run(create_test_user())