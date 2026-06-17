import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        body_metadata={"filter": {"file_name": "memory_test-session-1780301813765"}}
    )
    print("WITH filter file_name:", len(res.contexts))
    
    res2 = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        body_metadata={"file_name": "memory_test-session-1780301813765"}
    )
    print("WITH direct file_name:", len(res2.contexts))
except Exception as e:
    print("ERROR:", e)
