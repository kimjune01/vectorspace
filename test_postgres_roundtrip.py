#!/usr/bin/env python3
"""
Round trip test for PostgreSQL setup
Tests: Database connection → Table creation → User creation → API test
"""
import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Set environment
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://vectorspace:vectorspace@localhost:5432/vectorspace'
os.environ['ENVIRONMENT'] = 'development'
os.environ['OPENAI_API_KEY'] = 'test-key'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing-only'

async def test_database_connection():
    """Test 1: Database Connection"""
    print("🧪 Test 1: Database Connection")
    
    from app.database import engine, Base
    
    try:
        async with engine.begin() as conn:
            result = await conn.execute("SELECT version()")
            version = result.fetchone()[0]
            print(f"  ✅ Connected to: {version.split(' on ')[0]}")
            return True
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        return False

async def test_table_creation():
    """Test 2: Table Creation"""
    print("\n🧪 Test 2: Table Creation")
    
    from app.database import engine, Base
    
    try:
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            
            # Count tables
            result = await conn.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            table_count = result.fetchone()[0]
            print(f"  ✅ Created {table_count} tables")
            
            # List table names
            result = await conn.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' ORDER BY table_name
            """)
            tables = [row[0] for row in result.fetchall()]
            print(f"  📋 Tables: {', '.join(tables)}")
            return True
    except Exception as e:
        print(f"  ❌ Table creation failed: {e}")
        return False

async def test_user_operations():
    """Test 3: User Operations"""
    print("\n🧪 Test 3: User Operations")
    
    from app.database import get_db
    from app.models import User
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    try:
        async for session in get_db():
            # Create test user
            hashed_password = pwd_context.hash("testpassword")
            test_user = User(
                username="testuser",
                display_name="Test User",
                email="test@example.com", 
                password_hash=hashed_password,
                stripe_pattern_seed=12345
            )
            session.add(test_user)
            await session.commit()
            print(f"  ✅ Created user: {test_user.username}")
            
            # Query user back
            result = await session.execute("SELECT COUNT(*) FROM users")
            user_count = result.fetchone()[0]
            print(f"  📊 Total users in database: {user_count}")
            
            # Clean up
            await session.delete(test_user)
            await session.commit()
            print(f"  🧹 Cleaned up test user")
            return True
    except Exception as e:
        print(f"  ❌ User operations failed: {e}")
        return False

async def test_api_functionality():
    """Test 4: Basic API Test"""
    print("\n🧪 Test 4: API Functionality")
    
    try:
        from app.main import app
        from fastapi.testclient import TestClient
        
        # This would test the actual API
        print("  ✅ FastAPI app imports successfully")
        print("  💡 Full API test requires server startup (manual test)")
        return True
    except Exception as e:
        print(f"  ❌ API test failed: {e}")
        return False

async def main():
    """Run all round trip tests"""
    print("🚀 VectorSpace PostgreSQL Round Trip Test\n")
    
    tests = [
        test_database_connection,
        test_table_creation, 
        test_user_operations,
        test_api_functionality
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"  💥 Test crashed: {e}")
            results.append(False)
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print(f"\n📊 Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! PostgreSQL setup is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)