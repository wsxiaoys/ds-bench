import os
import sys
import json
import argparse
from alchemyst_ai import AlchemystAI

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", required=True, choices=["support", "billing", "engineering"])
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        sys.exit("ALCHEMYST_AI_API_KEY environment variable is not set.")
        
    run_id = os.environ.get("ZEALT_RUN_ID", "default_run")
    
    client = AlchemystAI(api_key=api_key)
    
    # Define groups and their documents
    seed_data = {
        "support": [
            "How to reset your password and secure your account.",
            "Troubleshooting login issues and two-factor authentication."
        ],
        "billing": [
            "How to update your credit card and payment methods.",
            "Understanding your monthly invoice and billing cycle."
        ],
        "engineering": [
            "Architecture overview of the backend services.",
            "API rate limits, retry policies, and error handling."
        ]
    }
    
    # Seed documents
    for group_name, docs in seed_data.items():
        for i, content in enumerate(docs):
            file_name = f"{group_name}_doc_{i+1}_{run_id}.txt"
            # Add document
            try:
                client.v1.context.add(
                    context_type="resource",
                    scope="internal",
                    source="cli_seed",
                    documents=[{"content": content}],
                    metadata={
                        "file_name": file_name,
                        "group_name": [group_name],
                        "file_size": len(content),
                        "file_type": "text/plain",
                        "last_modified": "2023-01-01T00:00:00Z"
                    }
                )
            except Exception as e:
                # ignore 409 Conflict for idempotency
                if "409" not in str(e):
                    print(f"Error during add: {e}", file=sys.stderr)
                    sys.exit(1)
            
    # Search for documents in the specified group
    try:
        response = client.v1.context.search(
            minimum_similarity_threshold=0.0,
            query="a", # A generic query to match documents
            similarity_threshold=1.0,
            metadata={"group_name": args.group}
        )
        
        file_names = set()
        if response.contexts:
            for ctx in response.contexts:
                if ctx.metadata:
                    # SDK might return metadata as dict
                    if isinstance(ctx.metadata, dict):
                        fn = ctx.metadata.get("file_name") or ctx.metadata.get("fileName")
                        if fn:
                            file_names.add(fn)
                            
        # Print the result as a single JSON array
        print(json.dumps(list(file_names)))
        
    except Exception as e:
        print(f"Error during search: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
