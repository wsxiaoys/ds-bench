import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
session_id = "session-test-idemp-456"

print("Adding...")
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Alice prefers Python for data processing pipelines"}]
)
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Alice prefers Python for data processing pipelines"}]
)

for i in range(10):
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="Alice prefers Python",
        metadata="true"
    )
    count = sum(1 for c in res.contexts if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}")
    if count > 0:
        print("COUNT:", count)
        break
    time.sleep(2)
