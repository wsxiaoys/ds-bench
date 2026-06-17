import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Python or PostgreSQL",
    metadata="true"
)
for c in res.contexts:
    if "Alice prefers Python" in c.content or "Bob recommends PostgreSQL" in c.content:
        print(c.content)
        print(c.metadata)
