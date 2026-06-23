import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="password",
        similarity_threshold=1.0,
        metadata="true",
        body_metadata='{"group_name": "support"}'
    )
    print("Search body_metadata string:", len(res.contexts))
    for ctx in res.contexts:
        print(ctx.metadata.get("file_name"))
except Exception as e:
    print("Search error:", e)
