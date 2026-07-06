#!/usr/bin/env python3
"""Probe4: docs are ingested; test which search body format applies group_name intersection."""
import os, sys, time, json, httpx

API_KEY = os.environ["ALCHEMYST_AI_API_KEY"]
BASE = "https://platform-backend.getalchemystai.com"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
RUN_ID = open("/logs/artifacts/run-id").read().strip()

def names_from(ctxs):
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
        if fn and fn.endswith(f"-{RUN_ID}.md"):
            out.add(fn)
    return sorted(out)

def do_search(label, body, query_params=None):
    url = f"{BASE}/api/v1/context/search"
    if query_params:
        url += "?" + "&".join(f"{k}={v}" for k,v in query_params.items())
    r = httpx.post(url, headers=HEADERS, json=body, timeout=60)
    if r.status_code != 200:
        print(f"[{label}] status={r.status_code} body={r.text[:150]}", file=sys.stderr); return
    data = r.json()
    ctxs = data.get("contexts") or data.get("context") or []
    print(f"[{label}] -> {names_from(ctxs)}", file=sys.stderr)

q = "engineering documentation onboarding auth tokens"
common = {"query": q, "minimum_similarity_threshold": 0.0, "similarity_threshold": 1.0, "scope": "internal"}

tests = {
    "eng,v1": ["eng","v1"], "v1": ["v1"], "eng,v2": ["eng","v2"],
    "docs,v1": ["docs","v1"], "eng": ["eng"], "docs": ["docs"], "v2": ["v2"],
}

print("Expect: eng,v1->docA ; v1->docA,docC ; eng,v2->docB ; docs,v1->docC ; eng->docA,docB ; docs->docC ; v2->docB", file=sys.stderr)

for label, groups in tests.items():
    do_search(f"F1 meta.groupName {label}", dict(common, metadata={"groupName": groups}), {"metadata":"true"})
for label, groups in [("eng,v1",["eng","v1"]),("v1",["v1"])]:
    do_search(f"F2 body_meta.groupName {label}", dict(common, body_metadata={"groupName": groups}), {"metadata":"true"})
for label, groups in [("eng,v1",["eng","v1"]),("v1",["v1"])]:
    do_search(f"F2b body_meta.group_name {label}", dict(common, body_metadata={"group_name": groups}), {"metadata":"true"})
for label, groups in [("eng,v1",["eng","v1"]),("v1",["v1"])]:
    do_search(f"F5 groupName {label}", dict(common, groupName=groups), {"metadata":"true"})
for label, groups in [("eng,v1",["eng","v1"]),("v1",["v1"])]:
    do_search(f"F6 meta.group_name {label}", dict(common, metadata={"group_name": groups}), {"metadata":"true"})
# F7: no filter baseline
do_search("F7 nofilter", dict(common), {"metadata":"true"})