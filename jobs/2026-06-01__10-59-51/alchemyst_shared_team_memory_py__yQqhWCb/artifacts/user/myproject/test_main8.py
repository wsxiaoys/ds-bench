import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
session_id = "session-test-indexing-123"

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Alice prefers Python",
    extra_body={"session_id": session_id},
    metadata="true"
)
print("TOTAL FOUND:", len(res.contexts))
for c in res.contexts:
    if "test indexing" in c.content:
        print("FOUND EXPECTED:", c.content)
