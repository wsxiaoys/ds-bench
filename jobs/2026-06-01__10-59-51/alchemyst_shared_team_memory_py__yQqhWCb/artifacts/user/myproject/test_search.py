import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY", "fake"))
try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="test",
        body_metadata={"session_id": "test_session"}
    )
    print(res)
except Exception as e:
    print("ERROR:", e)
