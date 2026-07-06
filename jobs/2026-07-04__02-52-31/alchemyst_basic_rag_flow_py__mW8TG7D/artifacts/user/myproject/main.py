#!/usr/bin/env python3
"""Basic RAG flow with the Alchemyst AI Python SDK.

Ingests a single 30-day refund policy document into the Alchemyst context
engine, then searches the context engine for a user-supplied question and
prints the retrieved chunks to stdout.
"""

import argparse
import os
import sys
from datetime import datetime, timezone

from alchemyst_ai import AlchemystAI

# Path to the run-id artifact used to keep concurrent runs from colliding.
RUN_ID_PATH = "/logs/artifacts/run-id"

# The policy document that will be ingested on every invocation.
REFUND_POLICY_CONTENT = (
    "Our refund policy: We offer a 30-day money back guarantee. "
    "If you are not satisfied with your purchase, you may request a full "
    "refund within 30 days of the original purchase date. To request a "
    "refund, contact support@example.com with your order number and a "
    "brief reason for the return. Refunds are processed within 5-7 "
    "business days."
)


def read_run_id(path: str = RUN_ID_PATH) -> str:
    """Read the run-id from the artifacts file, stripping whitespace."""
    try:
        with open(path, "r") as fh:
            return fh.read().strip()
    except FileNotFoundError:
        # Fall back to a placeholder so the program can still run locally.
        return "unknown-run-id"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Basic RAG flow with the Alchemyst AI Python SDK."
    )
    parser.add_argument(
        "--question",
        type=str,
        required=True,
        help="The question to search the context engine for.",
    )
    args = parser.parse_args()

    # The API key must be provided via the environment.
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print(
            "Error: ALCHEMYST_AI_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        sys.exit(1)

    run_id = read_run_id()
    file_name = f"refunds-{run_id}.md"

    client = AlchemystAI(api_key=api_key)

    # 1. Add the policy document to the context engine.
    # The API requires a top-level `metadata` record (a 400 is returned if it
    # is omitted) and expects `file_name`, `file_size`, `file_type` and
    # `last_modified`. We put the unique `file_name` there so concurrent runs
    # do not collide with a 409 Conflict.
    content_bytes = REFUND_POLICY_CONTENT.encode("utf-8")
    client.v1.context.add(
        documents=[
            {
                "content": REFUND_POLICY_CONTENT,
            }
        ],
        context_type="resource",
        source="documentation",
        scope="internal",
        metadata={
            "file_name": file_name,
            "file_size": len(content_bytes),
            "file_type": "text/markdown",
            "last_modified": datetime.now(timezone.utc).isoformat(),
        },
    )
    print(f"✅ Document stored ({file_name})")

    # 2. Search the context engine for the user's question.
    # NOTE: In SDK v0.10.0 both `minimum_similarity_threshold` and
    # `similarity_threshold` are required. `similarity_threshold` must be
    # >= `minimum_similarity_threshold`. We use a 0.5-0.7 window per the
    # docs' recommended range so relevant chunks are surfaced.
    result = client.v1.context.search(
        query=args.question,
        minimum_similarity_threshold=0.5,
        similarity_threshold=0.7,
        scope="internal",
    )

    contexts = result.contexts or []
    print(f"Found {len(contexts)} relevant chunks")

    if not contexts:
        print("No relevant contexts were found for the given question.")
        return

    for i, ctx in enumerate(contexts, start=1):
        print(f"--- Chunk {i} ---")
        print(ctx.content)
        print()


if __name__ == "__main__":
    main()