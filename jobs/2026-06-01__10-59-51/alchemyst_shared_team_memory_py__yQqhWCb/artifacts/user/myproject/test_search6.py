import os
import httpx
from alchemyst_ai import AlchemystAI

client = AlchemystAI()
# Let's mock httpx to see what it sends
def log_request(request):
    print(f"Request: {request.method} {request.url}")
    print(f"Headers: {request.headers}")
    print(f"Body: {request.content}")

client = AlchemystAI(http_client=httpx.Client(event_hooks={'request': [log_request]}))
client.v1.context.search(
    minimum_similarity_threshold=0.0,
    similarity_threshold=1.0,
    query="test",
    body_metadata={"session_id": "xyz"}
)
