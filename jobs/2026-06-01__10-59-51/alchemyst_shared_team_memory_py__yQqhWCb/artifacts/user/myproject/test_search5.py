import os
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
def test_filter(f):
    try:
        res = client.v1.context.search(
            minimum_similarity_threshold=0.0,
            similarity_threshold=1.0,
            query="test",
            body_metadata=f
        )
        print(f, len(res.contexts))
    except Exception as e:
        pass

test_filter({"$filter": {"file_name": "memory_test-session-1780301813765"}})
test_filter({"filters": {"file_name": "memory_test-session-1780301813765"}})
test_filter({"session_id": "test-session-1780301813765"})
test_filter({"filters": {"session_id": "test-session-1780301813765"}})
