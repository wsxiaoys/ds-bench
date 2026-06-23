import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
run_id = "test_run_999"
session_id = f"session-{run_id}"

for i in range(10):
    res = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        similarity_threshold=1.0,
        query="Python or PostgreSQL",
        metadata="true"
    )
    found = []
    for c in res.contexts:
        if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
            found.append(c.content)
    if len(found) >= 2:
        print("FOUND:")
        for f in found: print("-", f)
        break
    time.sleep(2)
