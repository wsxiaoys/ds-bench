import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
run_id = os.environ.get("ZEALT_RUN_ID", "test_run_999")
session_id = f"session-{run_id}"

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Python or PostgreSQL",
    metadata="true"
)
for c in res.contexts:
    if session_id in str(c.metadata):
        print("FOUND MATCHING SESSION IN METADATA:")
        print(c.content)
        print(c.metadata)
