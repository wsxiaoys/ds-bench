#!/usr/bin/env python3
import os
import sys
import argparse
from datetime import datetime, timezone
from alchemyst_ai import AlchemystAI

def main():
    # Parse CLI arguments
    parser = argparse.ArgumentParser(description="Alchemyst AI Basic RAG CLI")
    parser.add_argument("--question", required=True, help="The user question to search")
    args = parser.parse_args()

    # Read API key from environment
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # Read run-id from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    try:
        with open(run_id_path, "r") as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading run-id from {run_id_path}: {e}", file=sys.stderr)
        sys.exit(1)

    # Initialize AlchemystAI client
    client = AlchemystAI(api_key=api_key)

    # Define the policy document content
    policy_content = (
        "Refund Policy:\n"
        "We offer a 30-day refund policy for all our products and services. "
        "If you are not completely satisfied with your purchase, you can request "
        "a full refund within 30 days of the purchase date. To be eligible for a refund, "
        "you must submit your request to support@example.com along with your proof of purchase. "
        "Once approved, the refund will be processed and credited to your original payment method."
    )

    # Add the single policy document to the context engine
    file_name = f"refunds-{run_id}.md"
    try:
        add_response = client.v1.context.add(
            documents=[{"content": policy_content}],
            source="documentation",
            context_type="resource",
            scope="internal",
            metadata={
                "file_name": file_name,
                "file_type": "text/markdown",
                "last_modified": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "file_size": len(policy_content)
            }
        )
    except Exception as e:
        print(f"Error adding context: {e}", file=sys.stderr)
        sys.exit(1)

    # Search the context engine for the user's question
    try:
        search_response = client.v1.context.search(
            query=args.question,
            similarity_threshold=0.6,
            minimum_similarity_threshold=0.5,
            scope="internal"
        )
    except Exception as e:
        print(f"Error searching context: {e}", file=sys.stderr)
        sys.exit(1)

    # Print the retrieved chunks to stdout
    contexts = search_response.contexts
    if not contexts:
        print("No matching contexts found.")
    else:
        for ctx in contexts:
            if ctx.content:
                print(ctx.content)
            else:
                print("Found context, but it has no content.")

if __name__ == "__main__":
    main()
