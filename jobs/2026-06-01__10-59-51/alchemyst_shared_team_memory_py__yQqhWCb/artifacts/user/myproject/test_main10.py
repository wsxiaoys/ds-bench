import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
session_id = "session-test-idempotent-123"

for _ in range(2):
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": "Alice prefers Python for data processing pipelines"}]
    )

time.sleep(3)

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Alice prefers Python",
    metadata="true"
)
count = 0
for c in res.contexts:
    if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
        count += 1
print("COUNT:", count)
