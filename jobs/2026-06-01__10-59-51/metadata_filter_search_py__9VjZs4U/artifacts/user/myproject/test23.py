import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="*",
        similarity_threshold=1.0,
        metadata="true",
        body_metadata={"group_name": "support"}
    )
    print("body_metadata string:", len(res.contexts))
    
    res2 = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="*",
        similarity_threshold=1.0,
        metadata="true",
        body_metadata={"group_name": ["support"]}
    )
    print("body_metadata list:", len(res2.contexts))
except Exception as e:
    print("ERROR:", type(e), e)
