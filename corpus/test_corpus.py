#!/usr/bin/env python3
"""Simple test script for the Corpus service."""

import asyncio
import os
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

CORPUS_URL = "http://localhost:8001"


async def test_corpus_service():
    """Test the Corpus service endpoints."""
    async with httpx.AsyncClient() as client:
        print("🚀 Testing Corpus Service")
        print("=" * 50)
        
        # Test 1: Health check
        print("\n1. Testing health check...")
        try:
            response = await client.get(f"{CORPUS_URL}/health")
            if response.status_code == 200:
                print("✅ Health check passed")
                print(f"   Response: {response.json()}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Health check error: {e}")
        
        # Test 2: Detailed health check
        print("\n2. Testing detailed health check...")
        try:
            response = await client.get(f"{CORPUS_URL}/api/v1/debug/health")
            if response.status_code == 200:
                health_data = response.json()
                print("✅ Detailed health check passed")
                print(f"   Status: {health_data['status']}")
                print(f"   Uptime: {health_data['uptime_seconds']} seconds")
                print(f"   Collections: {list(health_data.get('collections', {}).keys())}")
            else:
                print(f"❌ Detailed health check failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Detailed health check error: {e}")
        
        # Test 3: List collections
        print("\n3. Testing collections list...")
        try:
            response = await client.get(f"{CORPUS_URL}/api/v1/admin/collections")
            if response.status_code == 200:
                collections = response.json()
                print("✅ Collections list retrieved")
                print(f"   Collections: {collections}")
            else:
                print(f"❌ Collections list failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Collections list error: {e}")
        
        # Test 4: Scraper status
        print("\n4. Testing scraper status...")
        try:
            response = await client.get(f"{CORPUS_URL}/api/v1/admin/scraper/status")
            if response.status_code == 200:
                status = response.json()
                print("✅ Scraper status retrieved")
                print(f"   Status: {status['status']}")
                print(f"   Posts processed: {status['posts_processed']}")
                if status.get('last_run'):
                    print(f"   Last run: {status['last_run']}")
            else:
                print(f"❌ Scraper status failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Scraper status error: {e}")
        
        # Test 5: Force scraper run (if enabled)
        run_scraper = input("\n🤔 Run a test scraper? (y/N): ").lower().strip() == 'y'
        if run_scraper:
            print("\n5. Testing manual scraper run...")
            try:
                response = await client.post(f"{CORPUS_URL}/api/v1/admin/scraper/force-run")
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Scraper run initiated")
                    print(f"   Message: {result['message']}")
                    print("   ⏳ Waiting 30 seconds for scraper to complete...")
                    await asyncio.sleep(30)
                    
                    # Check status again
                    status_response = await client.get(f"{CORPUS_URL}/api/v1/admin/scraper/status")
                    if status_response.status_code == 200:
                        status = status_response.json()
                        print(f"   Final status: {status['status']}")
                        print(f"   Posts processed: {status['posts_processed']}")
                else:
                    print(f"❌ Scraper run failed: {response.status_code}")
            except Exception as e:
                print(f"❌ Scraper run error: {e}")
        
        print("\n" + "=" * 50)
        print("🎯 Test completed! Check the logs above for any issues.")
        
        # Show service info
        print(f"\n📊 Service running at: {CORPUS_URL}")
        print(f"📚 API docs: {CORPUS_URL}/docs")
        print(f"🔍 Debug info: {CORPUS_URL}/api/v1/debug/health")


if __name__ == "__main__":
    print("Corpus Service Test Script")
    print("Make sure the service is running: uv run python main.py")
    print("And you have OPENAI_API_KEY set in your .env file")
    
    # Check if API key is available
    if not os.getenv("OPENAI_API_KEY"):
        print("\n⚠️  Warning: OPENAI_API_KEY not found in environment")
        print("   The service may not work properly without it")
    
    try:
        asyncio.run(test_corpus_service())
    except KeyboardInterrupt:
        print("\n👋 Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")