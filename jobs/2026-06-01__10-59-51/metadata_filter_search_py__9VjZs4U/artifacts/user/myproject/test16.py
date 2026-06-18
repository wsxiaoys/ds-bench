import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

print("Testing SEARCH with metadata={'group_name': ['support']}")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="password",
        similarity_threshold=1.0,
        metadata={"group_name": ["support"]}
    )
    print("SUCCESS")
    print(res.contexts[0].metadata if res.contexts else "No contexts")
except Exception as e:
    print("ERROR:", type(e), e)
