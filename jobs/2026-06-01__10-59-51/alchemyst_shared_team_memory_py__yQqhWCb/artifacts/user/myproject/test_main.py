import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
run_id = os.environ.get("ZEALT_RUN_ID", "test_run_123")
session_id = f"session-{run_id}"
alice_id = f"alice-{run_id}"
bob_id = f"bob-{run_id}"

print("SEEDING ALICE")
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Alice prefers Python for data processing pipelines"}],
    extra_body={"user_id": alice_id}
)

print("SEEDING BOB")
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Bob recommends PostgreSQL with TimescaleDB for time-series storage"}],
    extra_body={"user_id": bob_id}
)

time.sleep(3)

print("SEARCHING...")
res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Python or PostgreSQL",
    metadata="true"
)
for c in res.contexts:
    if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
        print("-", c.content)
