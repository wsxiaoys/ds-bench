#!/usr/bin/env python3
import os
import sys
import json
import time
import argparse
from alchemyst_ai import AlchemystAI

def extract_file_name(ctx, run_id):
    # Try metadata first
    metadata = getattr(ctx, "metadata", None)
    if metadata is None and isinstance(ctx, dict):
        metadata = ctx.get("metadata")
    
    if metadata:
        if isinstance(metadata, dict):
            fn = metadata.get("file_name") or metadata.get("fileName")
            if fn:
                return fn
        else:
            fn = getattr(metadata, "file_name", None) or getattr(metadata, "fileName", None)
            if fn:
                return fn

    # Try content marker
    content = getattr(ctx, "content", "")
    if not content and isinstance(ctx, dict):
        content = ctx.get("content", "")
    
    if content:
        import re
        match = re.search(r"__FILE_NAME__:\s*(doc[A-C]-" + re.escape(run_id) + r"\.md)", content)
        if match:
            return match.group(1)
            
        # Fallback to simple matching if content contains docA/docB/docC and run_id
        for letter in ["A", "B", "C"]:
            expected = f"doc{letter}-{run_id}.md"
            if expected in content:
                return expected

    return None

def main():
    parser = argparse.ArgumentParser(description="Alchemyst AI Context Arithmetic CLI")
    parser.add_argument("--groups", nargs="+", required=True, help="One or more group names to filter by")
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        sys.stderr.write("Error: ALCHEMYST_AI_API_KEY environment variable is not set.\n")
        sys.exit(1)

    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        sys.stderr.write("Error: ZEALT_RUN_ID environment variable is not set.\n")
        sys.exit(1)

    # Initialize client
    client = AlchemystAI(api_key=api_key)

    file_names = [f"docA-{run_id}.md", f"docB-{run_id}.md", f"docC-{run_id}.md"]

    # Ingest 3 documents
    docs_to_add = [
        {
            "content": f"__FILE_NAME__: docA-{run_id}.md\nThis is Document A. It contains engineering information for version 1.",
            "file_name": f"docA-{run_id}.md",
            "group_name": ["eng", "v1"]
        },
        {
            "content": f"__FILE_NAME__: docB-{run_id}.md\nThis is Document B. It contains engineering information for version 2.",
            "file_name": f"docB-{run_id}.md",
            "group_name": ["eng", "v2"]
        },
        {
            "content": f"__FILE_NAME__: docC-{run_id}.md\nThis is Document C. It contains documentation for version 1.",
            "file_name": f"docC-{run_id}.md",
            "group_name": ["docs", "v1"]
        }
    ]

    sys.stderr.write("Ingesting documents...\n")
    for doc in docs_to_add:
        try:
            client.v1.context.add(
                documents=[{"content": doc["content"]}],
                metadata={
                    "file_name": doc["file_name"],
                    "file_size": float(len(doc["content"])),
                    "file_type": "text/markdown",
                    "group_name": doc["group_name"],
                    "last_modified": "2026-06-01T10:00:00Z"
                },
                context_type="resource",
                source="docs",
                scope="internal"
            )
            sys.stderr.write(f"Successfully ingested {doc['file_name']}\n")
        except Exception as e:
            sys.stderr.write(f"Note: Ingestion for {doc['file_name']} failed/ignored (likely already exists): {e}\n")

    # Warm up search: wait until all 3 documents are indexed
    warmup_query = "Document"
    for attempt in range(1, 15):
        sys.stderr.write(f"Waiting for index to settle (attempt {attempt}/15)...\n")
        try:
            result = client.v1.context.search(
                query=warmup_query,
                scope="internal",
                minimum_similarity_threshold=0.1,
                similarity_threshold=0.9,
                metadata="true"
            )
            contexts = getattr(result, "contexts", None) or result.get("contexts", [])
            found_files = set()
            for ctx in contexts:
                fn = extract_file_name(ctx, run_id)
                if fn in file_names:
                    found_files.add(fn)
            
            sys.stderr.write(f"Found files in this attempt: {found_files}\n")
            if len(found_files) == 3:
                sys.stderr.write("All 3 documents are indexed and ready!\n")
                break
        except Exception as e:
            sys.stderr.write(f"Warning: search during warmup failed: {e}\n")
        time.sleep(2)
    else:
        sys.stderr.write("Warning: Not all 3 documents settled within timeout. Proceeding to search anyway.\n")

    # Perform filtered search
    sys.stderr.write(f"Searching with group filter: {args.groups}\n")
    try:
        result = client.v1.context.search(
            query="Document",
            scope="internal",
            minimum_similarity_threshold=0.1,
            similarity_threshold=0.9,
            metadata="true",
            body_metadata={
                "group_name": args.groups,
                "groupName": args.groups
            },
            extra_body={
                "metadata": {
                    "group_name": args.groups,
                    "groupName": args.groups
                }
            }
        )
        contexts = getattr(result, "contexts", None) or result.get("contexts", [])
    except Exception as e:
        sys.stderr.write(f"Error during filtered search: {e}\n")
        contexts = []

    matched_files = set()
    for ctx in contexts:
        fn = extract_file_name(ctx, run_id)
        if not fn:
            continue

        # Extract metadata
        metadata = getattr(ctx, "metadata", None) or {}
        if not isinstance(metadata, dict) and hasattr(ctx, "metadata"):
            metadata_dict = {}
            for k in ["group_name", "groupName", "file_name", "fileName"]:
                if hasattr(ctx.metadata, k):
                    metadata_dict[k] = getattr(ctx.metadata, k)
            metadata = metadata_dict

        gn = metadata.get("group_name") or metadata.get("groupName") or []

        # Perform intersection check: all groups in search must be in document groups
        if all(g in gn for g in args.groups):
            matched_files.add(fn)

    # Filter to only include current run's files
    valid_files = set(file_names)
    matched_files = matched_files.intersection(valid_files)

    # Format output as a JSON array of objects
    output = [{"file_name": fn} for fn in sorted(list(matched_files))]

    # Print the JSON array as the last line of stdout
    print(json.dumps(output))

if __name__ == "__main__":
    main()
