#!/usr/bin/env python3
import os
import sys
import argparse
from alchemyst_ai import AlchemystAI

def main():
    # Parse CLI arguments
    parser = argparse.ArgumentParser(description="Alchemyst AI Basic RAG CLI")
    parser.add_argument("--question", required=True, help="The question to search the context engine for.")
    args = parser.parse_args()

    # Read environment variables
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    zealt_run_id = os.environ.get("ZEALT_RUN_ID")
    if not zealt_run_id:
        print("Error: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # Initialize client
    client = AlchemystAI(api_key=api_key)

    # Prepare document details
    file_name = f"refunds-{zealt_run_id}.md"
    content_text = (
        "Our company refund policy states that we offer a full 30-day refund policy on all purchases. "
        "If you are not completely satisfied with your purchase, you can request a full refund within 30 days of purchase. "
        "Please contact support@example.com with your order number to request a refund."
    )

    # 1. Store the document in Alchemyst context engine
    try:
        client.v1.context.add(
            documents=[{
                "content": content_text
            }],
            context_type="resource",
            source="documentation",
            scope="internal",
            metadata={
                "file_name": file_name,
                "file_size": float(len(content_text.encode('utf-8'))),
                "file_type": "text/markdown",
                "last_modified": "2026-06-01T10:42:17Z"
            }
        )
    except Exception as e:
        print(f"Error adding document to context: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Search context engine for the user's question
    try:
        result = client.v1.context.search(
            query=args.question,
            minimum_similarity_threshold=0.6,
            similarity_threshold=0.6,
            scope="internal"
        )
    except Exception as e:
        print(f"Error searching context: {e}", file=sys.stderr)
        sys.exit(1)

    # Print the retrieved chunks to stdout
    contexts = getattr(result, "contexts", []) or []
    if not contexts:
        print("No matching context chunks found.")
    else:
        for ctx in contexts:
            # Print each retrieved chunk's content
            if hasattr(ctx, "content") and ctx.content:
                print(ctx.content)
            elif isinstance(ctx, dict) and "content" in ctx:
                print(ctx["content"])
            else:
                print(str(ctx))

if __name__ == "__main__":
    main()
