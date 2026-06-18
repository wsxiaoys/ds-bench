#!/usr/bin/env python3
"""Context Arithmetic (Intersection) CLI using the Alchemyst AI Python SDK.

Ingests documents with overlapping group_name tags, then searches using
intersection semantics (AND filter) and prints matching documents as JSON.
"""

import argparse
import json
import os
import sys
import time
import re

from alchemyst_ai import AlchemystAI


def main():
    parser = argparse.ArgumentParser(
        description="Search documents using Context Arithmetic intersection semantics"
    )
    parser.add_argument(
        "--groups",
        nargs="+",
        required=True,
        help="One or more group names for intersection search",
    )
    args = parser.parse_args()

    # --- Environment variables ------------------------------------------------
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("ERROR: ALCHEMYST_AI_API_KEY environment variable is not set", file=sys.stderr)
        sys.exit(1)

    run_id = os.environ.get("ZEALT_RUN_ID", "default")

    # --- Initialise client -----------------------------------------------------
    client = AlchemystAI(api_key=api_key)

    # --- Document definitions --------------------------------------------------
    # Each document's content includes a deterministic marker so we can recover
    # the file_name from chunk text if metadata.file_name is not on the chunk.
    doc_a_name = f"docA-{run_id}.md"
    doc_b_name = f"docB-{run_id}.md"
    doc_c_name = f"docC-{run_id}.md"

    documents = [
        {
            "content": f"[{doc_a_name}] Document A: Engineering practices for version 1 of the platform.",
            "metadata": {
                "file_name": doc_a_name,
                "group_name": ["eng", "v1"],
            },
        },
        {
            "content": f"[{doc_b_name}] Document B: Engineering practices for version 2 of the platform.",
            "metadata": {
                "file_name": doc_b_name,
                "group_name": ["eng", "v2"],
            },
        },
        {
            "content": f"[{doc_c_name}] Document C: Documentation standards for version 1 of the platform.",
            "metadata": {
                "file_name": doc_c_name,
                "group_name": ["docs", "v1"],
            },
        },
    ]

    # --- Delete existing documents first (rerunnability) ----------------------
    for doc in documents:
        fname = doc["metadata"]["file_name"]
        try:
            client.v1.context.delete(metadata={"file_name": fname})
            print(f"Deleted existing document: {fname}", file=sys.stderr)
        except Exception as exc:
            # Document may not exist yet – that is fine.
            print(f"Delete skipped for {fname}: {exc}", file=sys.stderr)

    # --- Ingest documents ------------------------------------------------------
    for doc in documents:
        fname = doc["metadata"]["file_name"]
        try:
            client.v1.context.add(
                documents=[doc],
                context_type="resource",
                source="docs",
                scope="internal",
            )
            print(f"Ingested document: {fname}", file=sys.stderr)
        except Exception as exc:
            # If we get a 409 Conflict the document already exists; continue.
            print(f"Add skipped for {fname}: {exc}", file=sys.stderr)

    # --- Wait for indexing to settle ------------------------------------------
    print("Waiting for indexing to settle …", file=sys.stderr)
    time.sleep(3)

    # --- Search with intersection filter --------------------------------------
    groups = args.groups
    print(f"Searching with groups (intersection): {groups}", file=sys.stderr)

    max_retries = 5
    contexts = []
    for attempt in range(1, max_retries + 1):
        try:
            search_result = client.v1.context.search(
                query="engineering documentation version",
                similarity_threshold=0.1,
                scope="internal",
                metadata={"group_name": groups},
            )
            contexts = search_result.contexts or []
            if contexts:
                print(f"Search returned {len(contexts)} chunk(s) on attempt {attempt}", file=sys.stderr)
                break
            print(f"Search attempt {attempt}: no results yet, retrying …", file=sys.stderr)
        except Exception as exc:
            print(f"Search attempt {attempt} failed: {exc}", file=sys.stderr)
        time.sleep(2)

    # --- Extract file_name from results and deduplicate -----------------------
    seen = set()
    output = []
    for ctx in contexts:
        file_name = None

        # Primary: try to get file_name from the chunk's metadata
        metadata = getattr(ctx, "metadata", None)
        if metadata:
            if isinstance(metadata, dict):
                file_name = metadata.get("file_name")
            else:
                file_name = getattr(metadata, "file_name", None)

        # Fallback: extract the deterministic marker from the content
        if not file_name:
            content = getattr(ctx, "content", "") or ""
            match = re.match(r"^\[([^\]]+)\]", content)
            if match:
                file_name = match.group(1)

        if file_name and file_name not in seen:
            seen.add(file_name)
            output.append({"file_name": file_name})

    # --- Print result as JSON (last line of stdout) ---------------------------
    print(json.dumps(output))


if __name__ == "__main__":
    main()