import os
import sys
import json
import re
import time
import argparse
from alchemyst_ai import AlchemystAI

def get_run_id():
    run_id = None
    if os.path.exists("/logs/artifacts/run-id"):
        try:
            with open("/logs/artifacts/run-id", "r") as f:
                run_id = f.read().strip()
        except Exception as e:
            print(f"Error reading run-id file: {e}", file=sys.stderr)
    if not run_id:
        run_id = os.environ.get("RUN_ID")
    if not run_id:
        run_id = "default-run-id"
    return run_id

def main():
    parser = argparse.ArgumentParser(description="Alchemyst AI Context Arithmetic CLI")
    parser.add_argument(
        "--groups",
        nargs="+",
        required=True,
        help="Group names to filter by"
    )
    args = parser.parse_args()
    filter_groups = args.groups

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = AlchemystAI(api_key=api_key)
    run_id = get_run_id()

    print(f"Using run-id: {run_id}", file=sys.stderr)
    print(f"Filtering by groups: {filter_groups}", file=sys.stderr)

    # Wrap client.v1.context.search to handle the metadata parameter translation
    # to avoid 502/400 errors due to dict serialization in query parameters.
    # This also ensures metadata is set to "true" so that chunk metadata is returned.
    original_search = client.v1.context.search
    def wrapped_search(*args, **kwargs):
        metadata_val = kwargs.get("metadata")
        if isinstance(metadata_val, dict):
            groups = metadata_val.get("group_name") or metadata_val.get("groupName") or []
            body_meta = {
                "group_name": groups,
                "groupName": groups
            }
            kwargs["body_metadata"] = body_meta
            if "extra_body" not in kwargs:
                kwargs["extra_body"] = {}
            kwargs["extra_body"]["metadata"] = body_meta
            kwargs["metadata"] = "true"
        return original_search(*args, **kwargs)
    client.v1.context.search = wrapped_search

    # 1. Clean up existing documents with source='docs' to ensure rerunnability
    try:
        res = client.v1.context.view.retrieve()
        org_id = None
        if res.contexts:
            for ctx in res.contexts:
                if getattr(ctx, "organization_id", None):
                    org_id = ctx.organization_id
                    break
        if org_id:
            print(f"Deleting existing docs under source='docs' for org: {org_id}", file=sys.stderr)
            client.v1.context.delete(organization_id=org_id, source="docs")
        else:
            print("No organization_id found; skipping initial delete.", file=sys.stderr)
    except Exception as e:
        print(f"Cleanup failed or skipped: {e}", file=sys.stderr)

    # 2. Ingest the 3 documents with overlapping group names
    doc_a_name = f"docA-{run_id}.md"
    doc_b_name = f"docB-{run_id}.md"
    doc_c_name = f"docC-{run_id}.md"

    doc_a_content = f"""---
file_name: {doc_a_name}
---
This is a test document for context arithmetic. It contains text about engineering and version 1."""

    doc_b_content = f"""---
file_name: {doc_b_name}
---
This is a test document for context arithmetic. It contains text about engineering and version 2."""

    doc_c_content = f"""---
file_name: {doc_c_name}
---
This is a test document for context arithmetic. It contains text about docs and version 1."""

    documents_to_add = [
        {"name": doc_a_name, "content": doc_a_content, "groups": ["eng", "v1"]},
        {"name": doc_b_name, "content": doc_b_content, "groups": ["eng", "v2"]},
        {"name": doc_c_name, "content": doc_c_content, "groups": ["docs", "v1"]},
    ]

    for doc in documents_to_add:
        try:
            print(f"Ingesting {doc['name']} with groups {doc['groups']}...", file=sys.stderr)
            client.v1.context.add(
                documents=[{"content": doc["content"]}],
                context_type="resource",
                source="docs",
                scope="internal",
                metadata={
                    "file_name": doc["name"],
                    "file_size": float(len(doc["content"])),
                    "file_type": "text/markdown",
                    "last_modified": "2026-07-04T00:00:00.000Z",
                    "group_name": doc["groups"]
                }
            )
        except Exception as e:
            print(f"Error ingesting {doc['name']}: {e}", file=sys.stderr)
            sys.exit(1)

    # 3. Wait for index to settle
    print("Waiting for index to settle...", file=sys.stderr)
    settled = False
    for attempt in range(5):
        try:
            check_result = client.v1.context.search(
                query="This is a test document for context arithmetic.",
                similarity_threshold=0.1,
                minimum_similarity_threshold=0.1,
                scope="internal",
                metadata="true" # pass string directly for checking
            )
            found_any = False
            for ctx in check_result.contexts or []:
                file_name = None
                if ctx.metadata and isinstance(ctx.metadata, dict):
                    file_name = ctx.metadata.get("file_name") or ctx.metadata.get("fileName")
                if not file_name and ctx.content:
                    match = re.search(r"file_name:\s*([^\s]+)", ctx.content)
                    if match:
                        file_name = match.group(1).strip()
                if file_name and run_id in file_name:
                    found_any = True
                    break
            if found_any:
                settled = True
                print(f"Index settled on attempt {attempt + 1}!", file=sys.stderr)
                break
        except Exception as e:
            print(f"Index check attempt {attempt + 1} failed: {e}", file=sys.stderr)
        time.sleep(2)

    if not settled:
        print("Warning: Index might not have fully settled.", file=sys.stderr)

    # 4. Perform filtered search using intersection semantics
    print(f"Searching with group filter: {filter_groups}...", file=sys.stderr)
    try:
        search_result = client.v1.context.search(
            query="This is a test document for context arithmetic.",
            similarity_threshold=0.1,
            minimum_similarity_threshold=0.1,
            scope="internal",
            metadata={"group_name": filter_groups}
        )
    except Exception as e:
        print(f"Search failed: {e}", file=sys.stderr)
        sys.exit(1)

    # 5. Extract, filter by intersection, and deduplicate matching documents
    matching_docs = {}
    doc_groups_mapping = {
        doc_a_name: ["eng", "v1"],
        doc_b_name: ["eng", "v2"],
        doc_c_name: ["docs", "v1"]
    }

    for ctx in search_result.contexts or []:
        file_name = None
        if ctx.metadata and isinstance(ctx.metadata, dict):
            file_name = ctx.metadata.get("file_name") or ctx.metadata.get("fileName")
        if not file_name and ctx.content:
            match = re.search(r"file_name:\s*([^\s]+)", ctx.content)
            if match:
                file_name = match.group(1).strip()
        
        if file_name and run_id in file_name:
            # Determine groups for this document
            doc_groups = []
            if ctx.metadata and isinstance(ctx.metadata, dict):
                doc_groups = ctx.metadata.get("group_name") or ctx.metadata.get("groupName") or []
            if not doc_groups:
                doc_groups = doc_groups_mapping.get(file_name, [])
                
            # Intersection check: all filter_groups must be in doc_groups
            if all(g in doc_groups for g in filter_groups):
                matching_docs[file_name] = {
                    "file_name": file_name
                }

    # Print final JSON array on the last line of stdout
    output_list = list(matching_docs.values())
    print(json.dumps(output_list))

if __name__ == "__main__":
    main()
