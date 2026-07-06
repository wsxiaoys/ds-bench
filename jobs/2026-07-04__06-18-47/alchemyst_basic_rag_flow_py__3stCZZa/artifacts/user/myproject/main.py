#!/usr/bin/env python3
"""Basic Alchemyst AI RAG flow.

Ingests a 30-day refund policy document into the Alchemyst context engine
and then searches it for the user's question, printing the retrieved
chunks to stdout.
"""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


POLICY_DOCUMENT = (
    "# 30-Day Refund Policy\n\n"
    "All customers are entitled to a full refund within 30 days of "
    "purchase. To request a refund, please contact our support team with "
    "your order number. Refunds are typically processed within 5-7 "
    "business days. Items must be returned in their original condition. "
    "Digital products are also eligible for the 30-day refund policy. "
    "If you have any questions about the refund process, please reach "
    "out to customer support."
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Basic Alchemyst AI RAG flow demo."
    )
    parser.add_argument(
        "--question",
        required=True,
        help="The user question to search the context engine for.",
    )
    args = parser.parse_args()

    api_key = os.environ["ALCHEMYST_AI_API_KEY"]

    with open("/logs/artifacts/run-id", "r", encoding="utf-8") as f:
        run_id = f.read().strip()

    client = AlchemystAI(api_key=api_key)

    # 1. Add the policy document into the context engine.
    client.v1.context.add(
        context_type="resource",
        source="documentation",
        scope="internal",
        documents=[{"content": POLICY_DOCUMENT}],
        metadata={
            "file_name": f"refunds-{run_id}.md",
            "file_size": float(len(POLICY_DOCUMENT)),
            "file_type": "text/markdown",
            "last_modified": "2024-01-01T00:00:00Z",
        },
    )

    # 2. Search the context engine for the user's question.
    search_response = client.v1.context.search(
        query=args.question,
        similarity_threshold=0.6,
        minimum_similarity_threshold=0.1,
        scope="internal",
    )

    contexts = getattr(search_response, "contexts", None) or []
    if not contexts:
        print("No contexts retrieved from the Alchemyst context engine.")
        return 0

    for chunk in contexts:
        content = getattr(chunk, "content", None)
        if content:
            print(content)

    return 0


if __name__ == "__main__":
    sys.exit(main())
