import os
import json
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="knowledge",
        similarity_threshold=1.0,
        metadata=json.dumps({"group_name": "support"})
    )
    if res.contexts:
        print(res.contexts[0])
except Exception as e:
    print("ERROR:", e)
