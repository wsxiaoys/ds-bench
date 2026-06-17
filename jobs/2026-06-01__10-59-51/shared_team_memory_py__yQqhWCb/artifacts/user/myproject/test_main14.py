import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
run_id = "test_run_12345"
session_id = f"session-{run_id}"

alice_phrase = f"Alice prefers Python for data processing pipelines (run: {run_id})"
res = client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": alice_phrase}]
)
print(res)
