import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
run_id = "test_run_12345"
session_id = f"session-{run_id}"

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Python",
    metadata="true"
)
for c in res.contexts:
    if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
        print(c.content)
