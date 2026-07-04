#!/usr/bin/env python3
"""Probe3: ingest 3 files via separate add calls (top-level metadata), then test search filters."""
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

files = [
    {
        "file_name": f"docA-{RUN_ID}.md",
        "group_name": ["eng", "v1"],
        "content": f"File: docA-{RUN_ID}.md\nEngineering API v1 design notes. The auth service exposes login and token refresh endpoints for version one.",
    },
    {
        "file_name": f"docB-{RUN_ID}.md",
        "group_name": ["eng", "v2"],
        "content": f"File: docB-{RUN_ID}.md\nEngineering API v2 design notes. The auth service in version two uses short-lived tokens and rotation.",
    },
    {
        "file_name": f"docC-{RUN_ID}.md",
        "group_name": ["docs", "v1"],
        "content": f"File: docC-{RUN_ID}.md\nDocumentation for v1 onboarding. New users follow the v1 quickstart guide to set up their account.",
    },
]

for f in files:
    body = {
        "context_type": "resource",
        "documents": [{"content": f["content"]}],
        "scope": "internal",
        "source": "docs",
        "metadata": {"fileName": f["file_name"], "groupName": f["group_name"]},
    }
    r = httpx.post(f"{BASE}/api/v1/context/add", headers=HEADERS, json=body, timeout=60)
    print(f"add {f['file_name']} status={r.status_code} body={r.text[:200]}", file=sys.stderr)

time.sleep(5)

def names_from(ctxs, run_id=RUN_ID):
    out = set()
    for c in (ctxs or []):
        md = c.get("metadata") or {}
        fn = None
        if isinstance(md, dict):
            fn = md.get("fileName") or md.get("file_name")
        if not fn and c.get("content"):
            for line in c["content"].splitlines():
                if line.startswith("File: "):
                    fn = line.split("File: ",1)[1].strip(); break
        if fn and fn.endswith(f"-{run_id}.md"):
            out.add(fn)
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

q = "engineering documentation onboarding auth tokens"

# F1: top-level metadata filter (camelCase) + metadata=true query
for groups in [["eng","v1"], ["v1"], ["eng","v2"], ["docs","v1"], ["eng"], ["docs"]]:
    do_search(f"F1 metadata.groupName {groups}",
              {"query": q, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "metadata": {"groupName": groups}},
              query_params={"metadata": "true"})

# F2: body_metadata with groupName
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F2 body_metadata.groupName {groups}",
              {"query": q, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "body_metadata": {"groupName": groups}},
              query_params={"metadata": "true"})

# F2b: body_metadata with group_name snake
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F2b body_metadata.group_name {groups}",
              {"query": q, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "body_metadata": {"group_name": groups}},
              query_params={"metadata": "true"})

# F5: top-level groupName (not nested)
for groups in [["eng","v1"], ["v1"]]:
    do_search(f"F5 groupName {groups}",
              {"query": q, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0,
               "scope": "internal", "groupName": groups},
              query_params={"metadata": "true"})