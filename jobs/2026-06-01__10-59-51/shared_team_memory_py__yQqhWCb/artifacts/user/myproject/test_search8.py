import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()

session_id = "test_session_xyz_123"
user_id = "test_user_xyz"

print("ADDING MEMORY")
client.v1.context.memory.add(
    user_id=user_id,
    session_id=session_id,
    contents=[{"content": "This is a super unique string 9988776655"}]
)

time.sleep(3)

print("SEARCHING MEMORY")
res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="9988776655",
    metadata="true"
)
for c in res.contexts:
    print(c.content)
    print(c.metadata)
