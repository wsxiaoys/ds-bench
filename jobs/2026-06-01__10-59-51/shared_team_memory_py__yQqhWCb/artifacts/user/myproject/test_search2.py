import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        body_metadata={"session_id": "test_session_xyz"}
    )
    print("WITH session_id directly:", len(res.contexts))
    
    res2 = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        body_metadata={"filter": {"session_id": "test_session_xyz"}}
    )
    print("WITH filter:", len(res2.contexts))
except Exception as e:
    print("ERROR:", e)
