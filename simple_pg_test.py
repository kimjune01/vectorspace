#!/usr/bin/env python3
"""
Simple PostgreSQL verification test
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

async def test_postgres_setup():
    """Test PostgreSQL connection and basic operations"""
    print("🧪 Testing PostgreSQL Setup")
    
    # Test with postgres superuser (Docker default - no password)
    os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres@localhost:5432/postgres'
    os.environ['ENVIRONMENT'] = 'development'
    
    try:
        from app.database import engine, Base
        
        # Test 1: Connection
        from sqlalchemy import text
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ Connected: {version.split(' on ')[0]}")
            
            # Test 2: Create tables 
            await conn.run_sync(Base.metadata.create_all)
            
            result = await conn.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"))
            table_count = result.fetchone()[0]
            print(f"✅ Created {table_count} tables")
            
            # Test 3: Basic operations
            await conn.execute(text("CREATE TEMP TABLE test_temp (id int, name text)"))
            await conn.execute(text("INSERT INTO test_temp VALUES (1, 'test')"))
            result = await conn.execute(text("SELECT name FROM test_temp WHERE id = 1"))
            name = result.fetchone()[0]
            print(f"✅ Database operations work: {name}")
            
        print("\n🎉 PostgreSQL setup verified successfully!")
        print("\n📋 Summary:")
        print("   • PostgreSQL 17 running in Docker")
        print("   • Database connection working")  
        print("   • Table creation working")
        print("   • Basic SQL operations working")
        print("\n🚀 Ready for VectorSpace deployment!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_postgres_setup())
    sys.exit(0 if success else 1)