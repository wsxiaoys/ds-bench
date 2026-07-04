#!/usr/bin/env python3
"""Raw HTTP probe: ingest docs (with top-level metadata) then test search body formats."""
import os
import sys
import time
import json
import httpx

API_KEY = os.environ["ALCHEMYST_AI_API_KEY"]
BASE = "https://platform-backend.getalchemystai.com"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

RUN_ID = open("/logs/artifacts/run-id").read().strip()
print(f"run-id={RUN_ID}", file=sys.stderr)

docs = [
    {"content": f"File: docA-{RUN_ID}.md\nEngineering API v1 design notes. auth service login token refresh endpoints version one.",
     "metadata": {"file_name": f"docA-{RUN_ID}.md", "group_name": ["eng", "v1"]}},
    {"content": f"File: docB-{RUN_ID}.md\nEngineering API v2 design notes. auth service version two short-lived tokens rotation.",
     "metadata": {"file_name": f"docB-{RUN_ID}.md", "group_name": ["eng", "v2"]}},
    {"content": f"File: docC-{RUN_ID}.md\nDocumentation v1 onboarding. New users follow v1 quickstart guide setup account.",
     "metadata": {"file_name": f"docC-{RUN_ID}.md", "group_name": ["docs", "v1"]}},
]

# Ingest via raw HTTP with top-level metadata
add_body = {
    "context_type": "resource",
    "documents": docs,
    "scope": "internal",
    "source": "docs",
    "metadata": {},
}
r = httpx.post(f"{BASE}/api/v1/context/add", headers=HEADERS, json=add_body, timeout=60)
print(f"add status={r.status_code} body={r.text[:300]}", file=sys.stderr)

time.sleep(4)

def names_from(ctxs):
    out = set()
    for c in (ctxs or []):
        md = c.get("metadata") or {}
        fn = md.get("file_name") or md.get("fileName") if isinstance(md, dict) else None
        if not fn and c.get("content"):
            for line in c["content"].splitlines():
                if line.startswith("File: "):
                    fn = line.split("File: ",1)[1].strip(); break
        if fn: out.add(fn)
    return sorted(out)

def do_search(label, body, query_params=None):
    url = f"{BASE}/api/v1/context/search"
    if query_params:
        url += "?" + "&".join(f"{k}={v}" for k,v in query_params.items())
    try:
        r = httpx.post(url, headers=HEADERS, json=body, timeout=60)
        if r.status_code != 200:
            print(f"[{label}] status={r.status_code} body={r.text[:200]}", file=sys.stderr)
            return
        data = r.json()
        ctxs = data.get("contexts") or data.get("context") or []
        print(f"[{label}] -> {names_from(ctxs)}", file=sys.stderr)
    except Exception as e:
        print(f"[{label}] EXC: {e}", file=sys.stderr)

base_query = "engineering documentation onboarding auth tokens"

# Format 1: top-level metadata (filter dict) in body, metadata=true query
for groups in [["eng","v1"], ["v1"], ["eng","v2"], ["docs","v1"]]:
    do_search(f"F1 metadata.group_name {groups}",
              {"query": base_query, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "metadata": {"group_name": groups}},
              query_params={"metadata": "true"})

# Format 2: body_metadata with group_name
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F2 body_metadata {groups}",
              {"query": base_query, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "body_metadata": {"group_name": groups}},
              query_params={"metadata": "true"})

# Format 3: top-level group_name in body
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F3 group_name {groups}",
              {"query": base_query, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "group_name": groups},
              query_params={"metadata": "true"})

# Format 4: metadata filter under "metadata" with groupName camelCase
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F4 metadata.groupName {groups}",
              {"query": base_query, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "metadata": {"groupName": groups}},
              query_params={"metadata": "true"})