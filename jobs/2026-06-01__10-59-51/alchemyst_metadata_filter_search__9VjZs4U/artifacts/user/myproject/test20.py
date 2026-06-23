import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="password",
        similarity_threshold=1.0,
        metadata="true",
        extra_body={"metadata": {"group_name": "support"}}
    )
    for ctx in res.contexts:
        print(ctx.metadata.get("group_name"), ctx.metadata.get("file_name"))
except Exception as e:
    print("ERROR:", type(e), e)
