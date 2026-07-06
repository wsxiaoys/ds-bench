#!/usr/bin/env python3
"""Probe script to determine which search parameters apply the group_name filter."""
import os
import sys
import time
import json

from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key=os.environ.get("ALCHEMYST_AI_API_KEY"))

RUN_ID = open("/logs/artifacts/run-id").read().strip()
print(f"run-id={RUN_ID}", file=sys.stderr)

docs = [
    {
        "content": f"File: docA-{RUN_ID}.md\nEngineering API v1 design notes. The auth service exposes login and token refresh endpoints for version one.",
        "metadata": {"file_name": f"docA-{RUN_ID}.md", "group_name": ["eng", "v1"]},
    },
    {
        "content": f"File: docB-{RUN_ID}.md\nEngineering API v2 design notes. The auth service in version two uses short-lived tokens and rotation.",
        "metadata": {"file_name": f"docB-{RUN_ID}.md", "group_name": ["eng", "v2"]},
    },
    {
        "content": f"File: docC-{RUN_ID}.md\nDocumentation for v1 onboarding. New users follow the v1 quickstart guide to set up their account.",
        "metadata": {"file_name": f"docC-{RUN_ID}.md", "group_name": ["docs", "v1"]},
    },
]

# Ingest (ignore conflicts for reruns)
try:
    client.v1.context.add(
        documents=docs,
        context_type="resource",
        source="docs",
        scope="internal",
    )
    print("ingest ok", file=sys.stderr)
except Exception as e:
    print(f"ingest error (maybe conflict): {e}", file=sys.stderr)

time.sleep(3)

def extract_file_names(result):
    names = set()
    for ctx in (result.contexts or []):
        md = ctx.metadata
        fn = None
        if isinstance(md, dict):
            fn = md.get("file_name") or md.get("fileName")
        if not fn and ctx.content:
            # marker fallback
            for line in ctx.content.splitlines():
                if line.startswith("File: "):
                    fn = line.split("File: ", 1)[1].strip()
                    break
        if fn:
            names.add(fn)
    return sorted(names)

# Test A: body_metadata filter, metadata="true"
print("\n=== Test A: body_metadata + metadata='true' ===", file=sys.stderr)
for groups in [["eng"], ["eng", "v1"], ["v1"], ["docs", "v1"], ["eng", "v2"]]:
    try:
        res = client.v1.context.search(
            query="engineering documentation onboarding auth tokens",
            minimum_similarity_threshold=0.0,
            similarity_threshold=1.0,
            metadata="true",
            body_metadata={"group_name": groups},
            scope="internal",
        )
        print(f"groups={groups} -> {extract_file_names(res)}", file=sys.stderr)
    except Exception as e:
        print(f"groups={groups} ERROR: {e}", file=sys.stderr)

# Test B: extra_body with metadata filter
print("\n=== Test B: extra_body metadata filter ===", file=sys.stderr)
for groups in [["eng", "v1"], ["v1"]]:
    try:
        res = client.v1.context.search(
            query="engineering documentation onboarding auth tokens",
            minimum_similarity_threshold=0.0,
            similarity_threshold=1.0,
            metadata="true",
            scope="internal",
            extra_body={"metadata": {"group_name": groups}},
        )
        print(f"groups={groups} -> {extract_file_names(res)}", file=sys.stderr)
    except Exception as e:
        print(f"groups={groups} ERROR: {e}", file=sys.stderr)