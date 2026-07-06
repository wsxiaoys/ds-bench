#!/usr/bin/env python3
"""Probe5: inspect returned metadata (groupName?) and confirm OR behavior for single groups."""
import os, sys, json, httpx

API_KEY = os.environ["ALCHEMYST_AI_API_KEY"]
BASE = "https://platform-backend.getalchemystai.com"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
RUN_ID = open("/logs/artifacts/run-id").read().strip()

def search(groups):
    body = {"query": "engineering documentation onboarding auth tokens",
            "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
            "scope": "internal", "body_metadata": {"groupName": groups}}
    r = httpx.post(f"{BASE}/api/v1/context/search?metadata=true", headers=HEADERS, json=body, timeout=60)
    data = r.json()
    ctxs = data.get("contexts") or []
    mine = [c for c in ctxs if c.get("content","").endswith(f"-{RUN_ID}.md") or (c.get("metadata") or {}).get("fileName","").endswith(f"-{RUN_ID}.md")]
    return ctxs, mine

# Inspect raw metadata of one of my docs
ctxs, mine = search(["eng"])
print("=== single group ['eng'] ===", file=sys.stderr)
for c in mine:
    print("fileName:", (c.get("metadata") or {}).get("fileName"), "metadata:", json.dumps(c.get("metadata")), file=sys.stderr)

print("\n=== single group ['docs'] ===", file=sys.stderr)
_, mine = search(["docs"])
print([ (c.get('metadata') or {}).get('fileName') for c in mine], file=sys.stderr)

print("\n=== single group ['v2'] ===", file=sys.stderr)
_, mine = search(["v2"])
print([ (c.get('metadata') or {}).get('fileName') for c in mine], file=sys.stderr)

print("\n=== full metadata sample (first my ctx) ===", file=sys.stderr)
ctxs, mine = search(["eng","v1"])
if mine:
    print(json.dumps(mine[0], indent=2, default=str)[:800], file=sys.stderr)