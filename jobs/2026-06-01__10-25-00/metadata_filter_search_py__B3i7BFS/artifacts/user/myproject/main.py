import os
import sys
import json
import argparse
from alchemyst_ai import AlchemystAI

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Alchemyst AI Metadata Filter Search")
    parser.add_argument(
        "--group",
        required=True,
        choices=["support", "billing", "engineering"],
        help="The team/group to search within"
    )
    args = parser.parse_args()
    group = args.group

    # Initialize Alchemyst AI client
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = AlchemystAI(api_key=api_key)

    # Get ZEALT_RUN_ID for namespacing
    run_id = os.environ.get("ZEALT_RUN_ID", "default_run")

    # Define documents to seed
    documents_to_seed = [
        # Support group
        {
            "content": f"This is support document one containing customer service guidelines for run {run_id}.",
            "group_name": "support",
            "file_name": f"support_doc1_{run_id}.txt"
        },
        {
            "content": f"This is support document two discussing refund and return policies for run {run_id}.",
            "group_name": "support",
            "file_name": f"support_doc2_{run_id}.txt"
        },
        # Billing group
        {
            "content": f"This is billing document one outlining payment methods and cycles for run {run_id}.",
            "group_name": "billing",
            "file_name": f"billing_doc1_{run_id}.txt"
        },
        {
            "content": f"This is billing document two explaining invoicing and tax collection for run {run_id}.",
            "group_name": "billing",
            "file_name": f"billing_doc2_{run_id}.txt"
        },
        # Engineering group
        {
            "content": f"This is engineering document one describing system architecture and APIs for run {run_id}.",
            "group_name": "engineering",
            "file_name": f"engineering_doc1_{run_id}.txt"
        },
        {
            "content": f"This is engineering document two detailing deployment procedures and CI/CD for run {run_id}.",
            "group_name": "engineering",
            "file_name": f"engineering_doc2_{run_id}.txt"
        }
    ]

    # Seed the documents
    for doc in documents_to_seed:
        try:
            res = client.v1.context.add(
                documents=[{"content": doc["content"]}],
                context_type="resource",
                source="docs",
                scope="internal",
                metadata={
                    "file_name": doc["file_name"],
                    "file_size": len(doc["content"]),
                    "file_type": "text/plain",
                    "group_name": [doc["group_name"]],
                    "last_modified": "2026-06-01T10:37:34"
                }
            )
        except Exception as e:
            # Check if it's a 409 conflict
            if hasattr(e, "status_code") and e.status_code == 409:
                pass
            elif "409" in str(e) or "Conflict" in str(e):
                pass
            else:
                print(f"Error seeding document {doc['file_name']}: {e}", file=sys.stderr)
                sys.exit(1)

    # Perform context search restricted to the requested group
    try:
        # We pass both group_name and groupName to support any API/mock expectations
        res_search = client.v1.context.search(
            query=group,
            similarity_threshold=0.7,
            minimum_similarity_threshold=0.3,
            metadata="true",
            body_metadata={
                "group_name": [group],
                "groupName": [group]
            }
        )
    except Exception as e:
        print(f"Error searching context: {e}", file=sys.stderr)
        sys.exit(1)

    # Extract, deduplicate, and filter file names
    file_names = []
    if res_search and res_search.contexts:
        for ctx in res_search.contexts:
            if ctx.metadata:
                fn = ctx.metadata.get("file_name") or ctx.metadata.get("fileName")
                if fn:
                    file_names.append(fn)

    # Deduplicate
    unique_file_names = list(set(file_names))

    # Filter by run_id to ensure concurrency safety
    if run_id:
        filtered_file_names = [fn for fn in unique_file_names if run_id in fn]
    else:
        filtered_file_names = unique_file_names

    # Print the result to stdout as a single JSON array
    print(json.dumps(filtered_file_names))

if __name__ == "__main__":
    main()
