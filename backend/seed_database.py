#!/usr/bin/env python3
"""
Database seeding script for VectorSpace
Creates a test user and sample data for development
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, Base, engine
from app.models import User
from sqlalchemy import select
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_test_user(db: AsyncSession):
    """Create a test user if it doesn't exist"""
    try:
        # Check if test user already exists
        result = await db.execute(
            select(User).where(User.username == "testuser")
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            logger.info("Test user already exists, updating display name...")
            existing_user.display_name = "Red Panda"
            existing_user.bio = "A curious red panda exploring the world of AI conversations 🐾"
            await db.commit()
            await db.refresh(existing_user)
            logger.info(f"Updated test user display name to: {existing_user.display_name}")
            return existing_user
        
        # Create test user
        test_user = User(
            username="testuser",
            display_name="Red Panda",
            email="test@example.com",
            bio="A curious red panda exploring the world of AI conversations 🐾"
        )
        test_user.set_password("testpass")
        
        db.add(test_user)
        await db.commit()
        await db.refresh(test_user)
        
        logger.info(f"Created test user: {test_user.username} (ID: {test_user.id})")
        return test_user
        
    except Exception as e:
        logger.error(f"Error creating test user: {e}")
        await db.rollback()
        raise


async def seed_database():
    """Main seeding function"""
    logger.info("Starting database seeding...")
    
    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Get a database session
    async for db in get_db():
        try:
            # Create test user
            test_user = await create_test_user(db)
            
            logger.info("Database seeding completed successfully!")
            logger.info("\nTest user credentials:")
            logger.info("Username: testuser")
            logger.info("Password: testpass")
            
        except Exception as e:
            logger.error(f"Database seeding failed: {e}")
            raise
        finally:
            await db.close()
        break


if __name__ == "__main__":
    asyncio.run(seed_database())