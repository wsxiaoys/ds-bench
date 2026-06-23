import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
session_id = "session-test-indexing-123"

res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Alice prefers Python for data processing pipelines - test indexing",
    user_id="alice-test-123",
    metadata="true"
)
for c in res.contexts:
    if "test indexing" in c.content:
        print("FOUND WITH USER ID:", c.content)
