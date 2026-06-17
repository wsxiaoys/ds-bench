import os
import sys
import json
import time
import argparse
from alchemystai import Alchemyst

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--groups", nargs="+", required=True)
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Missing ALCHEMYST_AI_API_KEY", file=sys.stderr)
        sys.exit(1)

    run_id = os.environ.get("ZEALT_RUN_ID", "default-run")

    client = Alchemyst(api_key=api_key)

    docs = [
        {
            "content": "Document A content for engineering v1.",
            "file_name": f"docA-{run_id}.md",
            "groups": ["eng", "v1"]
        },
        {
            "content": "Document B content for engineering v2.",
            "file_name": f"docB-{run_id}.md",
            "groups": ["eng", "v2"]
        },
        {
            "content": "Document C content for docs v1.",
            "file_name": f"docC-{run_id}.md",
            "groups": ["docs", "v1"]
        }
    ]

    for doc in docs:
        try:
            client.v1.context.add(
                content=doc["content"],
                context_type="resource",
                source="docs",
                scope="internal",
                metadata={
                    "file_name": doc["file_name"],
                    "group_name": doc["groups"]
                }
            )
            print(f"Added {doc['file_name']}", file=sys.stderr)
        except Exception as e:
            if "409" in str(e) or "Conflict" in str(e):
                print(f"Document {doc['file_name']} already exists, skipping.", file=sys.stderr)
            else:
                print(f"Error adding {doc['file_name']}: {e}", file=sys.stderr)

    # Wait for index to settle
    time.sleep(2)

    # Retry loop for search
    max_retries = 3
    results = []
    
    for attempt in range(max_retries):
        try:
            res = client.v1.context.search(
                query="Document content",
                scope="internal",
                similarity_threshold=0.01,
                metadata={
                    "group_name": args.groups
                }
            )
            
            if res and hasattr(res, 'contexts') and res.contexts:
                results = res.contexts
                break
            else:
                print("No results, retrying...", file=sys.stderr)
                time.sleep(2)
        except Exception as e:
            print(f"Search error: {e}", file=sys.stderr)
            time.sleep(2)

    # Deduplicate and extract file_name
    found_files = set()
    output = []
    
    for ctx in results:
        meta = getattr(ctx, "metadata", {})
        if isinstance(meta, dict):
            fname = meta.get("file_name")
        else:
            fname = getattr(meta, "file_name", None)
            
        if fname and fname.endswith(f"{run_id}.md") and fname not in found_files:
            found_files.add(fname)
            output.append({"file_name": fname})

    # The expected output must be the last line
    print(json.dumps(output))

if __name__ == "__main__":
    main()
