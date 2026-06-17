import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key="sk-123", base_url="http://localhost:8080")

print("Testing SEARCH with body_metadata")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="test",
        similarity_threshold=0.9,
        body_metadata={"group_name": "support"}
    )
    print(res)
except Exception as e:
    print(e)
