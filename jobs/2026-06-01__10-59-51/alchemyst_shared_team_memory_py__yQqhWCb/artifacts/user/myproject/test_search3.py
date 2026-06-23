import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        metadata="true",
        body_metadata={"session_id": "test_session_xyz"}
    )
    for c in res.contexts:
        print(c.metadata)
except Exception as e:
    print("ERROR:", e)
