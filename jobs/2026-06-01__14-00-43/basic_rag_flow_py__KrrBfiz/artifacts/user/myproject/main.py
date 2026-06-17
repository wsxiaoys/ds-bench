#!/usr/bin/env python3
"""Basic RAG flow using the Alchemyst AI Python SDK."""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


def main() -> None:
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Alchemyst AI Basic RAG CLI")
    parser.add_argument(
        "--question",
        required=True,
        help="The question to search for in the context engine",
    )
    args = parser.parse_args()

    # Read required environment variables
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    run_id = os.environ.get("ZEALT_RUN_ID", "default")

    # Initialize the Alchemyst client
    client = AlchemystAI(api_key=api_key)

    # Step 1: Add the refund policy document to the context engine
    file_name = f"refunds-{run_id}.md"

    client.v1.context.add(
        documents=[
            {
                "content": (
                    "Our refund policy: We offer a 30-day money-back guarantee on all purchases. "
                    "If you are not satisfied with your purchase, you can request a full refund within "
                    "30 days of the original purchase date. To initiate a refund, contact our support "
                    "team at support@example.com with your order number. Refunds will be processed "
                    "within 5-7 business days after approval."
                ),
                "metadata": {
                    "file_name": file_name,
                },
            }
        ],
        context_type="resource",
        source="documentation",
        scope="internal",
    )

    # Step 2: Search the context engine for the user's question
    result = client.v1.context.search(
        query=args.question,
        minimum_similarity_threshold=0.5,
        similarity_threshold=1.0,
        scope="internal",
    )

    contexts = result.contexts or []

    if not contexts:
        print("No relevant contexts found for your question.")
    else:
        for ctx in contexts:
            print(ctx.content)


if __name__ == "__main__":
    main()