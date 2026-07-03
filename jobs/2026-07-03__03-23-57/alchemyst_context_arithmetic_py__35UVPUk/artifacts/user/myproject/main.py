import os
import sys
import argparse
import time
import re
import json
from alchemyst_ai import AlchemystAI

def get_run_id():
    # Try reading from file `/logs/artifacts/run-id`
    try:
        if os.path.exists("/logs/artifacts/run-id"):
            with open("/logs/artifacts/run-id", "r") as f:
                return f.read().strip()
    except Exception:
        pass
    # Fallback to env var
    return os.environ.get("RUN_ID", "default-run-id")

def extract_file_name(ctx):
    # Try getting from metadata
    metadata = None
    if hasattr(ctx, "metadata"):
        metadata = ctx.metadata
    elif isinstance(ctx, dict) and "metadata" in ctx:
        metadata = ctx["metadata"]
        
    if metadata:
        if isinstance(metadata, dict):
            fn = metadata.get("file_name") or metadata.get("fileName")
            if fn:
                return fn
        else:
            # Maybe metadata is an object
            fn = getattr(metadata, "file_name", None) or getattr(metadata, "fileName", None)
            if fn:
                return fn
                
    # Fallback to regex on content
    content = ""
    if hasattr(ctx, "content"):
        content = ctx.content
    elif isinstance(ctx, dict) and "content" in ctx:
        content = ctx["content"]
        
    if content:
        match = re.search(r"\[FILE_NAME:\s*([^\]]+)\]", content)
        if match:
            return match.group(1).strip()
            
    return None

def main():
    parser = argparse.ArgumentParser(description="Context Arithmetic (Intersection) with Alchemyst AI Python SDK")
    parser.add_argument("--groups", nargs="+", required=True, help="One or more group names for intersection filtering")
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        sys.stderr.write("Error: ALCHEMYST_AI_API_KEY environment variable is not set.\n")
        sys.exit(1)

    # Initialize client
    client = AlchemystAI(api_key=api_key)

    run_id = get_run_id()
    sys.stderr.write(f"Using run-id: {run_id}\n")

    doc_a_name = f"docA-{run_id}.md"
    doc_b_name = f"docB-{run_id}.md"
    doc_c_name = f"docC-{run_id}.md"

    # Delete existing documents to ensure idempotency and avoid conflicts
    for doc_name in [doc_a_name, doc_b_name, doc_c_name]:
        try:
            sys.stderr.write(f"Attempting to delete existing document {doc_name}...\n")
            # Try both file_name and fileName inside metadata to be safe
            client.v1.context.delete(metadata={"file_name": doc_name})
            client.v1.context.delete(metadata={"fileName": doc_name})
        except Exception as e:
            sys.stderr.write(f"Note: deletion of {doc_name} skipped or failed (might not exist): {e}\n")

    # Define the three exact documents
    documents = [
        {
            "content": f"This is Document A content describing JWT tokens for engineering version 1. [FILE_NAME: {doc_a_name}]",
            "metadata": {
                "file_name": doc_a_name,
                "group_name": ["eng", "v1"]
            }
        },
        {
            "content": f"This is Document B content describing JWT tokens for engineering version 2. [FILE_NAME: {doc_b_name}]",
            "metadata": {
                "file_name": doc_b_name,
                "group_name": ["eng", "v2"]
            }
        },
        {
            "content": f"This is Document C content describing JWT tokens for documentation version 1. [FILE_NAME: {doc_c_name}]",
            "metadata": {
                "file_name": doc_c_name,
                "group_name": ["docs", "v1"]
            }
        }
    ]

    # Ingest documents
    sys.stderr.write("Ingesting documents...\n")
    try:
        client.v1.context.add(
            documents=documents,
            context_type="resource",
            source="docs",
            scope="internal"
        )
        sys.stderr.write("Ingestion successful.\n")
    except Exception as e:
        sys.stderr.write(f"Error ingesting documents: {e}\n")
        sys.exit(1)

    # Wait for the index to settle
    sys.stderr.write("Waiting for index to settle...\n")
    settled = False
    for attempt in range(15):
        try:
            # Document A and Document C both belong to 'v1', so searching for 'v1' should yield results
            test_res = client.v1.context.search(
                query="JWT tokens",
                scope="internal",
                similarity_threshold=0.1,
                metadata={"group_name": ["v1"]}
            )
            contexts = []
            if hasattr(test_res, "contexts"):
                contexts = test_res.contexts or []
            elif isinstance(test_res, dict) and "contexts" in test_res:
                contexts = test_res["contexts"] or []
            
            if len(contexts) > 0:
                sys.stderr.write(f"Index settled after {attempt + 1} attempts.\n")
                settled = True
                break
        except Exception as e:
            sys.stderr.write(f"Warm-up attempt {attempt + 1} failed: {e}\n")
        time.sleep(2)

    if not settled:
        sys.stderr.write("Warning: Index did not settle within timeout. Proceeding with search anyway.\n")

    # Perform the actual search with intersection filters
    sys.stderr.write(f"Searching with metadata filter group_name={args.groups}...\n")
    try:
        search_res = client.v1.context.search(
            query="JWT tokens",
            scope="internal",
            similarity_threshold=0.1,
            metadata={"group_name": args.groups}
        )
    except Exception as e:
        sys.stderr.write(f"Search failed: {e}\n")
        sys.exit(1)

    contexts = []
    if hasattr(search_res, "contexts"):
        contexts = search_res.contexts or []
    elif isinstance(search_res, dict) and "contexts" in search_res:
        contexts = search_res["contexts"] or []

    sys.stderr.write(f"Found {len(contexts)} chunks.\n")

    # Extract file names and deduplicate
    matched_files = set()
    for ctx in contexts:
        fn = extract_file_name(ctx)
        if fn:
            matched_files.add(fn)

    # Format output as required
    output_list = [{"file_name": fn} for fn in sorted(list(matched_files))]

    # Print JSON array as the last line of stdout
    print(json.dumps(output_list))

if __name__ == "__main__":
    main()
