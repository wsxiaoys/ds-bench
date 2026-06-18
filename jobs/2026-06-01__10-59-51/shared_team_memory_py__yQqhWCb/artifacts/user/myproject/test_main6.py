import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
session_id = "session-test-indexing-123"

print("SEEDING ALICE")
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Alice prefers Python for data processing pipelines - test indexing"}]
)

for i in range(10):
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="Alice prefers Python for data processing pipelines - test indexing",
        metadata="true"
    )
    found = False
    for c in res.contexts:
        if "test indexing" in c.content:
            print("FOUND:", c.content)
            found = True
    if found: break
    time.sleep(2)
