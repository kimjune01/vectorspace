"""
Test environment setup and performance optimizations.
"""
import os
import pytest
import unittest.mock
import sys

# Set environment variables before imports
os.environ["TESTING"] = "1"
os.environ["AI_MAX_TOKENS"] = "100"
os.environ["CHROMA_DB_PATH"] = ":memory:"

# Always mock sentence-transformers in tests to avoid loading heavy models
mock_sentence_transformers = unittest.mock.MagicMock()
sys.modules['sentence_transformers'] = mock_sentence_transformers

# Mock the embedding function to return simple vectors
class MockEmbeddingFunction:
    def __call__(self, texts):
        # Return simple embeddings based on text length
        if isinstance(texts, str):
            texts = [texts]
        return [[len(text) * 0.01 for _ in range(384)] for text in texts]

# Patch ChromaDB embedding functions before any imports
import chromadb.utils.embedding_functions as ef
original_st_ef = ef.SentenceTransformerEmbeddingFunction
ef.SentenceTransformerEmbeddingFunction = lambda **kwargs: MockEmbeddingFunction()

# Also patch the direct import path
sys.modules['chromadb.utils.embedding_functions'].SentenceTransformerEmbeddingFunction = lambda **kwargs: MockEmbeddingFunction()