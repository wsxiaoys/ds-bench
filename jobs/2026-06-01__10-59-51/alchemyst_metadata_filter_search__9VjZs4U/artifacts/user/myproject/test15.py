import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="knowledge",
        similarity_threshold=1.0,
        metadata="true"
    )
    for ctx in res.contexts:
        if "AI agents" in ctx.content:
            print(ctx.metadata)
except Exception as e:
    print("ERROR:", e)
