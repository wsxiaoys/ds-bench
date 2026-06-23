import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

print("Testing SEARCH with body_metadata")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="knowledge",
        similarity_threshold=0.9,
        body_metadata={"group_name": "support"}
    )
    print("SUCCESS")
except Exception as e:
    print("ERROR:", type(e), e)
