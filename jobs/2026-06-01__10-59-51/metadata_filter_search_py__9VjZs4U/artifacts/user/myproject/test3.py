import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key="sk-123")
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.1,
        query="test",
        similarity_threshold=0.9,
        metadata={"group_name": "support"}
    )
    print(res)
except Exception as e:
    print("Error:", type(e), e)
