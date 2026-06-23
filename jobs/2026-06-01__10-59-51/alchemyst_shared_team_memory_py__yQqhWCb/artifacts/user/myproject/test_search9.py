import os
import time
from alchemyst_ai import AlchemystAI

client = AlchemystAI()

session_id = "test_session_xyz_123"
user_id = "alice_test"

print("ADDING MEMORY")
client.v1.context.memory.add(
    session_id=session_id,
    contents=[{"content": "Alice test string 123456"}],
    extra_body={"user_id": user_id}
)

time.sleep(3)

print("SEARCHING MEMORY")
res = client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="Alice test string 123456",
    user_id=user_id,
    metadata="true"
)
for c in res.contexts:
    print(c.content)
    print(c.metadata)
