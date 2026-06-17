import os
import sys
import time
from alchemyst_ai import AlchemystAI

api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
run_id = "test_run_12345"
session_id = f"session-{run_id}"

client = AlchemystAI(api_key=api_key)

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="test",
    metadata="true"
)
for c in res.contexts:
    if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
        print(c.content)
