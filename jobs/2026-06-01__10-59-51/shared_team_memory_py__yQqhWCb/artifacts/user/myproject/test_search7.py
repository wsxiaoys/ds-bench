import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI()

def test_extra_body(body):
    try:
        res = client.v1.context.search(
            minimum_similarity_threshold=0.0,
            similarity_threshold=1.0,
            query="test",
            extra_body=body
        )
        print(body, len(res.contexts))
    except Exception as e:
        print("ERROR:", e)

test_extra_body({"metadata": {"session_id": "test-session-1780301813765"}})
test_extra_body({"filter": {"file_name": "memory_test-session-1780301813765"}})
test_extra_body({"file_name": "memory_test-session-1780301813765"})
test_extra_body({"metadata": {"file_name": "memory_test-session-1780301813765"}})
test_extra_body({"filters": {"file_name": "memory_test-session-1780301813765"}})
