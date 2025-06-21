#!/usr/bin/env python3
"""
Final round trip test: PostgreSQL + VectorSpace models + API
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Set up environment
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres@localhost:5432/postgres'
os.environ['ENVIRONMENT'] = 'development'
os.environ['OPENAI_API_KEY'] = 'test-key-for-testing'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret'

async def full_round_trip_test():
    """Complete test of PostgreSQL + VectorSpace functionality"""
    
    print("🚀 VectorSpace PostgreSQL Round Trip Test")
    print("=" * 50)
    
    try:
        from app.database import engine, Base, get_db
        from app.models import User, Conversation, Message
        from sqlalchemy import text
        from sqlalchemy.orm import selectinload
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Test 1: Database Connection & Table Creation
        print("\n📋 Test 1: Database & Tables")
        async with engine.begin() as conn:
            # Drop and recreate tables for clean test
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            
            result = await conn.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"))
            table_count = result.fetchone()[0]
            print(f"   ✅ Created {table_count} VectorSpace tables")
        
        # Test 2: User Creation
        print("\n👤 Test 2: User Operations")
        async for session in get_db():
            # Create test user
            test_user = User(
                username="testuser",
                display_name="Test User",
                email="test@vectorspace.local",
                password_hash=pwd_context.hash("testpass123"),
                stripe_pattern_seed=42,
                bio="Test user for round trip verification"
            )
            session.add(test_user)
            await session.commit()
            await session.refresh(test_user)
            print(f"   ✅ Created user: {test_user.username} (ID: {test_user.id})")
            
            # Test 3: Conversation Creation
            print("\n💬 Test 3: Conversation Operations")
            test_conversation = Conversation(
                title="Test Conversation",
                user_id=test_user.id,
                is_public=True,
                summary_public="A test conversation for verification"
            )
            session.add(test_conversation)
            await session.commit()
            await session.refresh(test_conversation)
            print(f"   ✅ Created conversation: {test_conversation.title} (ID: {test_conversation.id})")
            
            # Test 4: Message Creation
            print("\n📨 Test 4: Message Operations")
            test_message = Message(
                conversation_id=test_conversation.id,
                role="user",
                content="Hello, this is a test message!",
                token_count=10
            )
            session.add(test_message)
            await session.commit()
            await session.refresh(test_message)
            print(f"   ✅ Created message: {test_message.content[:30]}... (ID: {test_message.id})")
            
            # Test 5: Complex Query (Join)
            print("\n🔍 Test 5: Complex Queries")
            from sqlalchemy import select
            
            # Query conversations with user info
            stmt = select(Conversation).options(
                selectinload(Conversation.user),
                selectinload(Conversation.messages)
            ).where(Conversation.user_id == test_user.id)
            
            result = await session.execute(stmt)
            conversations = result.scalars().all()
            
            for conv in conversations:
                print(f"   ✅ Found conversation '{conv.title}' by {conv.user.username}")
                print(f"      - Messages: {len(conv.messages)}")
                print(f"      - Public: {conv.is_public}")
            
            # Test 6: Database Statistics
            print("\n📊 Test 6: Database Statistics")
            stats_queries = [
                ("Users", "SELECT COUNT(*) FROM users"),
                ("Conversations", "SELECT COUNT(*) FROM conversations"),
                ("Messages", "SELECT COUNT(*) FROM messages")
            ]
            
            for name, query in stats_queries:
                result = await session.execute(text(query))
                count = result.fetchone()[0]
                print(f"   📈 {name}: {count}")
            
            # Cleanup
            await session.delete(test_message)
            await session.delete(test_conversation)
            await session.delete(test_user)
            await session.commit()
            print(f"\n🧹 Cleaned up test data")
            
            break  # Exit the async generator
        
        # Test 7: API Import Test
        print("\n🔌 Test 7: API Components")
        try:
            from app.main import app
            from app.routers import auth, conversation, users
            print("   ✅ FastAPI app imports successfully")
            print("   ✅ All routers import successfully")
        except Exception as e:
            print(f"   ❌ API import failed: {e}")
            return False
        
        print("\n" + "=" * 50)
        print("🎉 ALL TESTS PASSED!")
        print("\n✅ VectorSpace is ready for deployment:")
        print("   • PostgreSQL connection: Working")
        print("   • Database tables: Created")
        print("   • User management: Working")
        print("   • Conversations: Working")
        print("   • Messages: Working")
        print("   • Complex queries: Working")
        print("   • API components: Working")
        print("\n🚂 Ready for Railway deployment!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(full_round_trip_test())
    sys.exit(0 if success else 1)