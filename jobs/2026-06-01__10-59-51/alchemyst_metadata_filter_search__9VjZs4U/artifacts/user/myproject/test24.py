import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

try:
    client.v1.context.add(
        context_type="resource",
        scope="internal",
        source="cli_seed",
        documents=[{"content": "this is a test document for support"}],
        metadata={
            "file_name": "test_support.txt",
            "group_name": "support",
            "file_size": 100,
            "file_type": "text/plain",
            "last_modified": "2023-01-01T00:00:00Z"
        }
    )
    print("Added")
except Exception as e:
    print("Add error:", e)

try:
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query="test document",
        similarity_threshold=1.0,
        metadata="true",
        body_metadata={"group_name": "support"}
    )
    print("Search body_metadata string:", len(res.contexts))
    for ctx in res.contexts:
        print(ctx.metadata)
except Exception as e:
    print("Search error:", e)
