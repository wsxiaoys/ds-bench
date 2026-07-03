#!/usr/bin/env python3
"""Basic RAG flow CLI using the Alchemyst AI Python SDK.

Ingests a single 30-day refund policy document into the Alchemyst context
engine and then searches it for the user's question, printing any
retrieved chunks to stdout.
"""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


# The policy document that will be ingested on every invocation.
REFUND_POLICY_CONTENT = (
    "Our refund policy: We offer a 30-day money back guarantee. "
    "If you are not satisfied with your purchase, you may request a "
    "full refund within 30 days of the original purchase date. "
    "To request a refund, contact support@example.com with your order "
    "number and a brief reason for the return. Refunds are processed "
    "within 5-7 business days."
)

# Path to the run-id artifact that keeps concurrent runs from colliding.
RUN_ID_PATH = "/logs/artifacts/run-id"


def read_run_id() -> str:
    """Read the run-id from the artifacts directory.

    Returns the stripped run-id value, or an empty string if the file
    cannot be read (so the program can still proceed, albeit without
    uniqueness).
    """
    try:
        with open(RUN_ID_PATH, "r") as f:
            return f.read().strip()
    except OSError as exc:
        print(f"Warning: could not read run-id from {RUN_ID_PATH}: {exc}",
              file=sys.stderr)
        return ""


def main() -> None:
    # --- Parse command-line arguments ---
    parser = argparse.ArgumentParser(
        description="Search the Alchemyst context engine for a refund policy."
    )
    parser.add_argument(
        "--question",
        required=True,
        help="The question to search the context engine for.",
    )
    args = parser.parse_args()
    question = args.question

    # --- Read the API key from the environment ---
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.",
              file=sys.stderr)
        sys.exit(1)

    # --- Read the run-id so concurrent runs don't collide ---
    run_id = read_run_id()

    # --- Build a unique file_name using the run-id ---
    file_name = f"refunds-{run_id}.md" if run_id else "refunds.md"

    # --- Initialize the Alchemyst client ---
    client = AlchemystAI(api_key=api_key)

    # --- Step 1: Add the refund policy document ---
    client.v1.context.add(
        documents=[
            {
                "content": REFUND_POLICY_CONTENT,
                "metadata": {
                    "file_name": file_name,
                },
            }
        ],
        context_type="resource",
        source="documentation",
        scope="internal",
    )
    print("Document stored successfully.")

    # --- Step 2: Search the context engine for the user's question ---
    result = client.v1.context.search(
        query=question,
        similarity_threshold=0.6,
        scope="internal",
    )

    contexts = result.contexts or []

    if not contexts:
        print("No relevant contexts found for the given question.")
        return

    print(f"Found {len(contexts)} relevant chunk(s):\n")
    for i, ctx in enumerate(contexts, start=1):
        print(f"--- Chunk {i} ---")
        print(ctx.content)
        print()


if __name__ == "__main__":
    main()