import os
import json
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

print("Testing SEARCH with metadata as JSON string")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="knowledge",
        similarity_threshold=0.9,
        metadata=json.dumps({"group_name": "support"})
    )
    print("SUCCESS")
    print(res.contexts[0].metadata if res.contexts else "No contexts")
except Exception as e:
    print("ERROR:", type(e), e)
