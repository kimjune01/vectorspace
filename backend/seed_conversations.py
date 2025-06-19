#!/usr/bin/env python3
"""
Database Seeding Script for VectorSpace
========================================

This script populates the local database with sample conversations
to test semantic search functionality.
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
import json

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import async_session, Base, engine
from app.models import User, Conversation, Message
from app.services.vector_service import VectorService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Sample conversations with diverse topics for semantic search testing
SAMPLE_CONVERSATIONS = [
    {
        "title": "Introduction to Machine Learning",
        "summary": "A beginner's guide to understanding machine learning concepts, algorithms, and applications in real-world scenarios.",
        "messages": [
            {"role": "user", "content": "Can you explain what machine learning is and how it works?"},
            {"role": "assistant", "content": "Machine learning is a branch of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task. It works by using algorithms to identify patterns in data and make predictions or decisions based on those patterns. There are three main types: supervised learning (learning from labeled examples), unsupervised learning (finding hidden patterns in data), and reinforcement learning (learning through trial and error with rewards)."},
            {"role": "user", "content": "What are some common algorithms used in machine learning?"},
            {"role": "assistant", "content": "Some popular machine learning algorithms include: Linear Regression for predicting continuous values, Decision Trees for classification and regression, Random Forest for ensemble learning, Support Vector Machines (SVM) for classification, K-Means for clustering, Neural Networks for complex pattern recognition, and Gradient Boosting for improved predictions. Each algorithm has its strengths and is suited for different types of problems."},
            {"role": "user", "content": "How is machine learning used in everyday applications?"},
            {"role": "assistant", "content": "Machine learning is everywhere in our daily lives! It powers recommendation systems on Netflix and Spotify, enables voice assistants like Siri and Alexa, filters spam emails, detects fraud in banking, provides personalized content on social media, powers autonomous vehicles, helps with medical diagnosis, optimizes search results on Google, and enables real-time language translation. It's also used in weather forecasting, stock market analysis, and even dating app matching algorithms."}
        ]
    },
    {
        "title": "The Future of Renewable Energy",
        "summary": "Discussion about renewable energy technologies, their potential impact on climate change, and the transition to sustainable power sources.",
        "messages": [
            {"role": "user", "content": "What's the current state of renewable energy adoption globally?"},
            {"role": "assistant", "content": "Renewable energy adoption has accelerated dramatically in recent years. As of 2024, renewables account for about 30% of global electricity generation, with solar and wind leading the growth. Countries like Denmark get over 50% of their electricity from wind, while Costa Rica runs almost entirely on renewables. China leads in absolute renewable capacity, while Nordic countries excel in percentage adoption. The cost of solar has dropped by 90% since 2010, making it the cheapest electricity source in many regions."},
            {"role": "user", "content": "What are the main challenges facing renewable energy expansion?"},
            {"role": "assistant", "content": "Key challenges include: Intermittency (solar and wind aren't always available), requiring better energy storage solutions like advanced batteries. Grid infrastructure needs upgrading to handle distributed energy sources. Initial capital costs are high despite long-term savings. Political and regulatory barriers slow adoption. There's also the challenge of energy storage at scale, material scarcity for batteries and solar panels, and the need for workforce retraining in traditional energy sectors."},
            {"role": "user", "content": "How might energy storage technology evolve to support renewables?"},
            {"role": "assistant", "content": "Energy storage is evolving rapidly with several promising technologies: Lithium-ion batteries are becoming cheaper and more efficient. Solid-state batteries promise higher energy density and safety. Flow batteries offer long-duration storage for grid applications. Compressed air energy storage and pumped hydro provide large-scale solutions. Green hydrogen production during excess renewable generation can store energy for months. Advanced materials like sodium-ion and iron-air batteries could reduce costs further. AI optimization is also improving how we manage and predict energy storage needs."}
        ]
    },
    {
        "title": "Modern Web Development Best Practices",
        "summary": "Comprehensive discussion about current web development trends, frameworks, performance optimization, and security considerations.",
        "messages": [
            {"role": "user", "content": "What are the most important web development trends in 2024?"},
            {"role": "assistant", "content": "Key web development trends in 2024 include: Server-side rendering (SSR) and static site generation (SSG) for better performance and SEO. Component-based architectures with React, Vue, or Svelte. JAMstack architecture for faster, more secure sites. Progressive Web Apps (PWAs) for native-like experiences. WebAssembly for high-performance web applications. Headless CMS solutions for content management. Edge computing for reduced latency. AI integration for personalization and automation."},
            {"role": "user", "content": "How important is web performance optimization and what are the best practices?"},
            {"role": "assistant", "content": "Web performance is crucial - every 100ms delay can reduce conversions by 1%. Best practices include: Optimizing images with WebP/AVIF formats and lazy loading. Minimizing and compressing CSS/JavaScript. Using CDNs for global content delivery. Implementing code splitting to load only necessary resources. Utilizing browser caching strategies. Minimizing HTTP requests. Optimizing Critical Rendering Path. Using service workers for offline functionality. Measuring performance with tools like Lighthouse, WebPageTest, and Core Web Vitals."},
            {"role": "user", "content": "What security considerations should modern web developers keep in mind?"},
            {"role": "assistant", "content": "Essential security practices include: Implementing HTTPS everywhere with proper SSL/TLS configuration. Using Content Security Policy (CSP) headers to prevent XSS attacks. Sanitizing and validating all user inputs. Implementing proper authentication with secure session management. Using OWASP guidelines for common vulnerabilities. Keeping dependencies updated and scanning for vulnerabilities. Implementing rate limiting and DDoS protection. Using secure cookies with HttpOnly and SameSite flags. Regular security audits and penetration testing. Following the principle of least privilege for API access."}
        ]
    },
    {
        "title": "The Psychology of Productivity",
        "summary": "Exploring psychological principles behind productivity, motivation theories, and evidence-based strategies for improving personal effectiveness.",
        "messages": [
            {"role": "user", "content": "What does psychology tell us about productivity and motivation?"},
            {"role": "assistant", "content": "Psychology reveals that productivity isn't just about time management - it's deeply connected to motivation, cognitive load, and mental energy. Key insights include: The Pomodoro Technique works because our brains need regular breaks to maintain focus. Intrinsic motivation (autonomy, mastery, purpose) is more sustainable than external rewards. Flow states occur when challenge matches skill level. Decision fatigue depletes mental energy throughout the day. The Zeigarnik Effect shows we remember unfinished tasks better, creating mental clutter."},
            {"role": "user", "content": "How can someone overcome procrastination using psychological principles?"},
            {"role": "assistant", "content": "Anti-procrastination strategies based on psychology: Break tasks into smaller, less overwhelming chunks (reduces anxiety). Use implementation intentions ('If X, then Y' planning). Apply the 2-minute rule for immediate small tasks. Address perfectionism by setting 'good enough' standards. Use temptation bundling (pairing unpleasant tasks with enjoyable activities). Leverage social accountability and commitment devices. Practice self-compassion instead of self-criticism. Address underlying fears of failure or success. Use environmental design to reduce friction for desired behaviors."},
            {"role": "user", "content": "What role does the environment play in productivity?"},
            {"role": "assistant", "content": "Environment significantly impacts productivity through multiple channels: Physical space affects cognitive performance - clutter increases cortisol and reduces focus. Natural light and plants improve mood and concentration. Temperature between 68-72°F optimizes cognitive function. Noise levels matter - moderate ambient noise can boost creativity, but loud noise impairs focus. Color psychology suggests blue enhances focus while green reduces eye strain. Social environment influences behavior through peer effects and social norms. Digital environment design (app interfaces, notification settings) shapes attention patterns and habits."}
        ]
    },
    {
        "title": "Quantum Computing Fundamentals",
        "summary": "Introduction to quantum computing principles, current applications, and potential future impact on technology and cryptography.",
        "messages": [
            {"role": "user", "content": "Can you explain quantum computing in simple terms?"},
            {"role": "assistant", "content": "Quantum computing uses the strange properties of quantum mechanics to process information differently than classical computers. While classical bits are either 0 or 1, quantum bits (qubits) can be in 'superposition' - both 0 and 1 simultaneously until measured. This allows quantum computers to explore many solution paths at once. They also use 'entanglement' where qubits become mysteriously connected, and changes to one instantly affect another. These properties enable quantum computers to solve certain problems exponentially faster than classical computers."},
            {"role": "user", "content": "What problems can quantum computers solve that classical computers cannot?"},
            {"role": "assistant", "content": "Quantum computers excel at specific problem types: Factoring large numbers (threatening current encryption), simulating quantum systems for drug discovery and materials science, solving optimization problems in logistics and finance, searching unsorted databases quadratically faster, and machine learning with quantum advantage. However, they're not universally superior - for most everyday computing tasks, classical computers remain better. Quantum computers are more like specialized tools for specific computational challenges rather than general-purpose replacements."},
            {"role": "user", "content": "What's the current state of quantum computing development?"},
            {"role": "assistant", "content": "Quantum computing is in the 'NISQ era' (Noisy Intermediate-Scale Quantum) with 50-1000 qubits but high error rates. Major players include IBM, Google, Rigetti, and IonQ with different approaches (superconducting, trapped ion, photonic). Google claimed 'quantum supremacy' in 2019, though practical applications remain limited. Current challenges include quantum error correction, maintaining coherence, and scaling up qubit counts. We're probably 10-20 years from fault-tolerant quantum computers that can break encryption or solve real-world optimization problems at scale."}
        ]
    },
    {
        "title": "Sustainable Urban Planning",
        "summary": "Discussion about creating environmentally sustainable and livable cities, including transportation, green spaces, and smart city technologies.",
        "messages": [
            {"role": "user", "content": "What makes a city sustainable and how can urban planning contribute?"},
            {"role": "assistant", "content": "Sustainable cities balance environmental, economic, and social needs. Key principles include: Compact, mixed-use development to reduce transportation needs. Efficient public transit and bike-friendly infrastructure. Green building standards and renewable energy integration. Urban forests and green spaces for air quality and mental health. Waste reduction and circular economy principles. Water management including rainwater harvesting and permeable surfaces. Social equity ensuring affordable housing and services for all residents. Smart city technologies for resource optimization."},
            {"role": "user", "content": "How can cities reduce their carbon footprint through better design?"},
            {"role": "assistant", "content": "Cities can dramatically reduce emissions through strategic design: Transit-oriented development reduces car dependency. District energy systems improve efficiency. Green buildings with passive design reduce energy needs. Urban heat island reduction through vegetation and reflective surfaces. Localized energy generation with rooftop solar and microgrids. Waste-to-energy systems and improved recycling. Green infrastructure for stormwater management. 15-minute neighborhoods where daily needs are accessible by foot or bike. Electric vehicle infrastructure and car-sharing programs. Circular economy initiatives to minimize waste."},
            {"role": "user", "content": "What role does technology play in smart city development?"},
            {"role": "assistant", "content": "Technology enables data-driven urban management: IoT sensors monitor air quality, traffic, and energy usage in real-time. AI optimizes traffic lights and public transit schedules. Smart grids balance renewable energy supply and demand. Digital platforms improve citizen engagement and service delivery. Predictive analytics help prevent infrastructure failures. Mobile apps integrate transportation options and city services. Big data analytics inform policy decisions. However, privacy, equity, and cybersecurity concerns must be addressed. The goal is technology that serves citizens, not surveils them."}
        ]
    },
    {
        "title": "The Science of Memory and Learning",
        "summary": "Exploring how memory works, effective learning strategies based on cognitive science, and techniques for improving retention and recall.",
        "messages": [
            {"role": "user", "content": "How does human memory actually work from a scientific perspective?"},
            {"role": "assistant", "content": "Memory involves three key processes: encoding (taking in information), storage (maintaining it over time), and retrieval (accessing it when needed). There are different memory systems: sensory memory (brief, milliseconds), short-term/working memory (limited capacity, 15-30 seconds), and long-term memory (unlimited capacity, permanent). Long-term memory includes explicit memory (conscious facts and events) and implicit memory (unconscious skills and habits). Memories aren't stored like files but as patterns of neural connections that are reconstructed each time we remember."},
            {"role": "user", "content": "What are the most effective learning strategies based on cognitive science research?"},
            {"role": "assistant", "content": "Evidence-based learning strategies include: Spaced repetition - reviewing material at increasing intervals strengthens retention. Retrieval practice - testing yourself is more effective than re-reading. Interleaving - mixing different topics improves discrimination and transfer. Elaborative interrogation - asking 'why' and 'how' questions deepens understanding. Dual coding - combining verbal and visual information. The generation effect - producing answers rather than recognizing them. Distributed practice - spreading learning over time beats cramming. These techniques work because they align with how our memory systems naturally function."},
            {"role": "user", "content": "How can someone improve their memory and avoid forgetting important information?"},
            {"role": "assistant", "content": "Memory improvement strategies: Use mnemonic devices like the method of loci or acronyms for complex information. Practice active recall instead of passive review. Create meaningful connections between new and existing knowledge. Use multiple senses when learning (see, hear, touch). Get adequate sleep - memory consolidation happens during sleep. Exercise regularly to promote neuroplasticity. Minimize interference by organizing learning sessions. Use external memory aids (calendars, notes) strategically. Pay attention fully when encoding information. Review material just before sleep for better consolidation."}
        ]
    },
    {
        "title": "Cryptocurrency and Blockchain Technology",
        "summary": "Understanding blockchain fundamentals, cryptocurrency mechanics, and the potential applications beyond digital currency.",
        "messages": [
            {"role": "user", "content": "Can you explain how blockchain technology works and why it's considered revolutionary?"},
            {"role": "assistant", "content": "Blockchain is a distributed ledger technology that maintains a continuously growing list of records (blocks) linked using cryptography. Each block contains a cryptographic hash of the previous block, timestamp, and transaction data. What makes it revolutionary: Decentralization eliminates single points of failure and control. Immutability makes records extremely difficult to alter. Transparency allows public verification. Consensus mechanisms ensure agreement without central authority. This creates trust in trustless environments, enabling peer-to-peer transactions without intermediaries like banks or governments."},
            {"role": "user", "content": "What are the practical applications of blockchain beyond cryptocurrency?"},
            {"role": "assistant", "content": "Blockchain applications extend far beyond crypto: Supply chain tracking for food safety and authenticity verification. Digital identity management for secure, user-controlled credentials. Smart contracts for automated agreement execution. Medical records for secure, interoperable health data. Voting systems for transparent, tamper-proof elections. Real estate for streamlined property transfers. Intellectual property protection for patents and copyrights. Carbon credit trading for environmental sustainability. Digital art and NFTs for provenance verification. These applications leverage blockchain's core properties of transparency, immutability, and decentralization."},
            {"role": "user", "content": "What are the main challenges and limitations of blockchain technology?"},
            {"role": "assistant", "content": "Key blockchain challenges include: Scalability - Bitcoin processes ~7 transactions/second vs Visa's 65,000. Energy consumption - Proof of Work consensus is environmentally costly. Regulation uncertainty creates legal and compliance risks. User experience is complex for non-technical users. Interoperability between different blockchain networks is limited. Storage costs increase as blockchain size grows. 51% attacks are possible on smaller networks. Quantum computing could threaten cryptographic security. There's also the oracle problem - difficulty getting reliable external data into smart contracts. These limitations are being addressed through layer-2 solutions, alternative consensus mechanisms, and improved protocols."}
        ]
    }
]

async def create_test_user() -> User:
    """Create a test user for seeding conversations."""
    async with async_session() as session:
        # Check if test user already exists
        result = await session.execute(
            select(User).where(User.username == "testuser")
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print("✅ Test user already exists")
            return existing_user
        
        # Create new test user
        test_user = User(
            username="testuser",
            display_name="Test User",
            email="test@vectorspace.com",
            bio="A test user for seeding conversations and testing semantic search functionality."
        )
        test_user.set_password("testpassword")
        
        session.add(test_user)
        await session.commit()
        await session.refresh(test_user)
        print("✅ Created test user: testuser")
        return test_user

async def seed_conversation(session: AsyncSession, user: User, conv_data: dict, vector_service: VectorService):
    """Create a single conversation with messages."""
    
    # Create conversation
    conversation = Conversation(
        user_id=user.id,
        title=conv_data["title"],
        summary_public=conv_data["summary"],
        is_public=True,
        is_hidden_from_profile=False
    )
    
    session.add(conversation)
    await session.flush()  # Get the conversation ID
    
    print(f"📝 Creating conversation: {conv_data['title']}")
    
    # Create messages
    total_tokens = 0
    for i, msg_data in enumerate(conv_data["messages"]):
        # Estimate token count (rough approximation: 1 token ≈ 4 characters)
        token_count = len(msg_data["content"]) // 4
        total_tokens += token_count
        
        message = Message(
            conversation_id=conversation.id,
            from_user_id=user.id if msg_data["role"] == "user" else None,
            role=msg_data["role"],
            message_type="chat",
            content=msg_data["content"],
            token_count=token_count,
            parent_message_id=None,
            timestamp=datetime.now() - timedelta(hours=24-i)  # Spread over last 24 hours
        )
        
        session.add(message)
        
        # Add to vector database for semantic search
        try:
            await vector_service.add_message_to_vector_db(
                message_id=f"temp_{conversation.id}_{i}",  # Temporary ID
                content=msg_data["content"],
                conversation_id=conversation.id,
                metadata={
                    "role": msg_data["role"],
                    "conversation_title": conv_data["title"],
                    "conversation_summary": conv_data["summary"]
                }
            )
            print(f"  ✅ Added message {i+1} to vector database")
        except Exception as e:
            print(f"  ⚠️  Warning: Could not add message to vector DB: {e}")
    
    # Update conversation with total token count
    conversation.token_count = total_tokens
    conversation.last_message_at = datetime.utcnow()
    
    await session.commit()
    print(f"  ✅ Created conversation with {len(conv_data['messages'])} messages ({total_tokens} tokens)")

async def seed_database():
    """Main function to seed the database with sample conversations."""
    print("🌱 Starting database seeding...")
    
    # Initialize database (create tables)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize vector service
    vector_service = VectorService()
    
    # Create test user
    user = await create_test_user()
    
    # Check existing conversations
    async with async_session() as session:
        result = await session.execute(
            select(Conversation).where(Conversation.user_id == user.id)
        )
        existing_conversations = result.scalars().all()
        
        if existing_conversations:
            print(f"📚 Found {len(existing_conversations)} existing conversations")
            response = input("Do you want to delete existing conversations and reseed? (y/N): ")
            if response.lower() == 'y':
                for conv in existing_conversations:
                    await session.delete(conv)
                await session.commit()
                print("🗑️  Deleted existing conversations")
            else:
                print("✅ Keeping existing conversations")
                return
    
    # Seed conversations
    print(f"\n📝 Seeding {len(SAMPLE_CONVERSATIONS)} conversations...")
    
    async with async_session() as session:
        for i, conv_data in enumerate(SAMPLE_CONVERSATIONS, 1):
            print(f"\n{i}/{len(SAMPLE_CONVERSATIONS)}:")
            await seed_conversation(session, user, conv_data, vector_service)
    
    print(f"\n🎉 Successfully seeded database with {len(SAMPLE_CONVERSATIONS)} conversations!")
    print("\n📊 Seeded conversation topics:")
    for conv in SAMPLE_CONVERSATIONS:
        print(f"  • {conv['title']}")
    
    print(f"\n🔍 Test semantic search with queries like:")
    print("  • 'machine learning algorithms'")
    print("  • 'renewable energy solar wind'") 
    print("  • 'web development performance'")
    print("  • 'productivity psychology motivation'")
    print("  • 'quantum computing qubits'")
    print("  • 'sustainable cities urban planning'")
    print("  • 'memory learning strategies'")
    print("  • 'blockchain cryptocurrency applications'")

if __name__ == "__main__":
    asyncio.run(seed_database())