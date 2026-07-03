#!/usr/bin/env python3
"""Basic RAG flow using the Alchemyst AI Python SDK.

On every invocation this CLI:
1. Adds a single 30-day refund policy document to the Alchemyst context engine.
2. Searches the context engine for the user supplied question.
3. Prints each retrieved chunk's ``content`` to stdout.
"""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


RUN_ID_PATH = "/logs/artifacts/run-id"

POLICY_CONTENT = (
    "Our refund policy: We offer a 30-day money back guarantee. "
    "Customers may request a full refund within 30 days of purchase by "
    "contacting support@example.com with their order number. Refunds are "
    "processed within 5-7 business days to the original payment method."
)


def read_run_id(path: str) -> str:
    """Return the run id stored on disk, stripping any trailing whitespace."""
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read().strip()


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a basic RAG flow against the Alchemyst context engine.",
    )
    parser.add_argument(
        "--question",
        required=True,
        help="The user question to search the context engine with.",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        return 1

    run_id = read_run_id(RUN_ID_PATH)
    file_name = f"refunds-{run_id}.md"

    client = AlchemystAI(api_key=api_key)

    # 1. Add the policy document to the context engine.
    client.v1.context.add(
        documents=[
            {
                "content": POLICY_CONTENT,
                "metadata": {
                    "file_name": file_name,
                },
            }
        ],
        context_type="resource",
        source="documentation",
        scope="internal",
    )

    # 2. Search the context engine for the user's question.
    result = client.v1.context.search(
        query=args.question,
        scope="internal",
        similarity_threshold=0.6,
    )

    contexts = getattr(result, "contexts", None) or []

    if not contexts:
        print("No relevant chunks were returned for the question.")
        return 0

    for chunk in contexts:
        content = getattr(chunk, "content", None)
        if content:
            print(content)
    return 0


if __name__ == "__main__":
    sys.exit(main())
