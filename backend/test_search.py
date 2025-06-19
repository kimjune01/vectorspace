#!/usr/bin/env python3
import sys
import os
sys.path.append('app')

from app.services.vector_service import VectorService

def test_search():
    vector_service = VectorService()
    
    queries = [
        "machine learning algorithms",
        "renewable energy solar wind", 
        "web development performance",
        "productivity psychology motivation",
        "quantum computing qubits",
        "sustainable cities",
        "memory learning strategies",
        "blockchain cryptocurrency"
    ]
    
    for query in queries:
        print(f"\n🔍 Query: '{query}'")
        try:
            results = vector_service.search_similar_conversations(query, n_results=2)
            
            if results['documents'][0]:
                for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
                    title = metadata.get('title', 'No title')
                    distance = results['distances'][0][i]
                    print(f"  {i+1}. {title} (similarity: {1-distance:.3f})")
            else:
                print("  No results found")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    test_search()