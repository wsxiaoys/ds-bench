#!/usr/bin/env python3
"""Basic RAG flow demo using the Alchemyst AI Python SDK."""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


REFUND_POLICY_TEXT = """# Refund Policy

Our company offers a 30-day refund policy on all products purchased
directly from our online store. If you are not satisfied with your
purchase for any reason, you may request a full refund within 30 days
of the original purchase date.

To be eligible for a refund:
- The request must be submitted within 30 days of the purchase date.
- The product must be in its original condition.
- Proof of purchase (such as an order number or receipt) is required.

Refunds are issued to the original payment method and typically appear
within 5-10 business days after approval. Items returned after the
30-day window are not eligible for a refund but may qualify for store
credit at our discretion.
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Alchemyst AI basic RAG flow demo."
    )
    parser.add_argument(
        "--question",
        required=True,
        help="The question to ask the Alchemyst context engine.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print(
            "ERROR: ALCHEMYST_AI_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        return 1

    run_id = os.environ.get("ZEALT_RUN_ID", "local")
    file_name = f"refunds-{run_id}.md"

    client = AlchemystAI(api_key=api_key)

    # 1. Ingest the policy document into the Alchemyst context engine.
    client.v1.context.add(
        context_type="resource",
        source="documentation",
        scope="internal",
        documents=[{"content": REFUND_POLICY_TEXT}],
        metadata={
            "file_name": file_name,
            "file_type": "text/markdown",
            "file_size": float(len(REFUND_POLICY_TEXT.encode("utf-8"))),
        },
    )

    # 2. Search the context engine for chunks relevant to the question.
    response = client.v1.context.search(
        query=args.question,
        scope="internal",
        similarity_threshold=0.7,
        minimum_similarity_threshold=0.5,
    )

    contexts = getattr(response, "contexts", None) or []
    if not contexts:
        print("No relevant context chunks were retrieved.")
        return 0

    for index, ctx in enumerate(contexts, start=1):
        content = getattr(ctx, "content", None) or ""
        print(f"--- Chunk {index} ---")
        print(content)
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
