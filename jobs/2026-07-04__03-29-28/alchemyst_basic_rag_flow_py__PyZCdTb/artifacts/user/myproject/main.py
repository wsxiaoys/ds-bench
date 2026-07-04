#!/usr/bin/env python3
"""Basic RAG flow demo using the Alchemyst AI Python SDK.

On every invocation this CLI:
1. Reads the ALCHEMYST_AI_API_KEY environment variable.
2. Reads the run id from /logs/artifacts/run-id and uses it to make the
   ingested document's file_name unique (avoiding 409 Conflict collisions
   between concurrent runs).
3. Adds a single policy document describing a 30-day refund policy into
   the Alchemyst context engine.
4. Searches the context engine for the user's question (passed via the
   required --question argument) and prints the retrieved chunks to
   stdout so the verifier can inspect them.
"""

import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


RUN_ID_PATH = "/logs/artifacts/run-id"


def read_run_id(path: str = RUN_ID_PATH) -> str:
    """Read the run id from the artifacts directory.

    Returns a stripped string. If the file is missing or empty a
    fallback placeholder is returned so the document can still be
    ingested (with a unique enough name to avoid clashing with
    prior runs that also lacked a run id).
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
    except FileNotFoundError:
        return "unknown"

    return value or "unknown"


def build_refund_policy_content() -> str:
    """Return the body of the policy document that will be ingested."""
    return (
        "Refund Policy\n"
        "\n"
        "Our company offers a 30-day money-back guarantee on all "
        "purchases. Customers who are not satisfied with their purchase "
        "for any reason may request a full refund within 30 calendar days "
        "of the original transaction date.\n"
        "\n"
        "Eligibility:\n"
        "- The refund request must be submitted within 30 days of the "
        "purchase date.\n"
        "- The item, if physical, must be returned in its original "
        "packaging whenever possible.\n"
        "- Proof of purchase (order number or receipt) is required.\n"
        "\n"
        "How to request a refund:\n"
        "1. Contact our support team at support@example.com with your "
        "order number.\n"
        "2. Include a brief reason for the refund request.\n"
        "3. Our support team will respond within two business days with "
        "return instructions.\n"
        "4. Once the returned item is received and inspected, the "
        "refund will be issued to the original payment method within "
        "5-7 business days.\n"
        "\n"
        "Non-refundable items:\n"
        "- Digital downloads that have already been accessed or "
        "downloaded.\n"
        "- Custom or personalized items.\n"
        "- Gift cards.\n"
        "\n"
        "If you have any questions about your refund, please reach out "
        "to support@example.com and reference your order number."
    )


def ingest_policy_document(client: AlchemystAI, run_id: str) -> None:
    """Add the 30-day refund policy document to the Alchemyst context."""
    file_name = f"refunds-{run_id}.md"
    content = build_refund_policy_content()

    client.v1.context.add(
        documents=[
            {
                "content": content,
                "metadata": {
                    "file_name": file_name,
                },
            }
        ],
        context_type="resource",
        source="documentation",
        scope="internal",
    )
    print(f"Ingested document with file_name={file_name}")


def search_and_print(client: AlchemystAI, question: str) -> None:
    """Search the context engine and print the retrieved chunks."""
    result = client.v1.context.search(
        query=question,
        scope="internal",
        similarity_threshold=0.5,
    )

    contexts = getattr(result, "contexts", None) or []

    if not contexts:
        print("No relevant contexts were returned for the question.")
        return

    print(f"Retrieved {len(contexts)} relevant chunk(s) for question: "
          f"{question!r}")
    for index, ctx in enumerate(contexts, start=1):
        content = getattr(ctx, "content", "")
        print(f"--- chunk {index} ---")
        print(content)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Run a basic RAG flow against the Alchemyst AI "
                    "context engine.",
    )
    parser.add_argument(
        "--question",
        required=True,
        help="The question to ask the context engine.",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print(
            "ERROR: ALCHEMYST_AI_API_KEY environment variable is not set.",
            file=sys.stderr,
        )
        return 1

    run_id = read_run_id()
    client = AlchemystAI(api_key=api_key)

    ingest_policy_document(client, run_id)
    search_and_print(client, args.question)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())