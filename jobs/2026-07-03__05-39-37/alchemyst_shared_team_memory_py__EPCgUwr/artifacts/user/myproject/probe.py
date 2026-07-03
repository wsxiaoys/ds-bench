import os, time, json
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ["ALCHEMYST_AI_API_KEY"])
run_id = open("/logs/artifacts/run-id").read().strip()
session_id = f"session-{run_id}"
print("session_id:", session_id)

# Seed alice
r1 = client.v1.context.memory.add(
    contents=[{"content": "Alice prefers Python for data processing pipelines"}],
    session_id=session_id,
    metadata={"group_name": [session_id]},
)
print("alice add:", r1)

r2 = client.v1.context.memory.add(
    contents=[{"content": "Bob recommends PostgreSQL with TimescaleDB for time-series storage"}],
    session_id=session_id,
    metadata={"group_name": [session_id]},
)
print("bob add:", r2)

def try_search(label, **kw):
    print("\n--- search:", label, kw)
    try:
        res = client.v1.context.search(
            minimum_similarity_threshold=0.0,
            similarity_threshold=0.0,
            query="team preferences for data processing and storage",
            metadata="true",
            **kw,
        )
        ctxs = res.contexts or []
        print("  count:", len(ctxs))
        for c in ctxs:
            print("   -", repr(c.content), "| meta:", c.metadata)
        return [c.content for c in ctxs if c.content]
    except Exception as e:
        print("  ERROR:", type(e).__name__, str(e)[:300])
        return []

# wait for indexing
for i in range(8):
    time.sleep(3)
    a = try_search("group_name filter", body_metadata={"group_name": [session_id]})
    if any("Alice prefers" in (x or "") for x in a) and any("Bob recommends" in (x or "") for x in a):
        print("\n>>> BOTH FOUND with group_name filter")
        break