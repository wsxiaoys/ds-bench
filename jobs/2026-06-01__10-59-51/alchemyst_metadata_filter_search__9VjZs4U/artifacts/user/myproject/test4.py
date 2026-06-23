import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key="sk-123", base_url="http://localhost:8080")

print("Testing ADD")
try:
    client.v1.context.add(
        context_type="resource",
        scope="internal",
        source="my_cli",
        documents=[{"content": "hello"}],
        metadata={"file_name": "test.txt", "group_name": ["support"]}
    )
except Exception as e:
    print(e)

print("Testing SEARCH")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="test",
        similarity_threshold=0.9,
        metadata={"group_name": "support"}
    )
    print(res)
except Exception as e:
    print(e)
