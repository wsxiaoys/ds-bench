import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

print("Testing SEARCH with group_name as string")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="knowledge",
        similarity_threshold=0.9,
        metadata={"group_name": "support"}
    )
    print("SUCCESS")
except Exception as e:
    print("ERROR:", type(e), e)

print("Testing SEARCH with group_name as list")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="knowledge",
        similarity_threshold=0.9,
        metadata={"group_name": ["support"]}
    )
    print("SUCCESS")
except Exception as e:
    print("ERROR:", type(e), e)
