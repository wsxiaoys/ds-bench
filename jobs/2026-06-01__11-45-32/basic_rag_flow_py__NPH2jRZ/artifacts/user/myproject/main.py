import argparse
import os
import sys

from alchemyst_ai import AlchemystAI


def build_refund_policy() -> str:
    return (
        "Refund Policy\n"
        "\n"
        "We offer a 30-day refund policy for all purchases. If you are not satisfied, you "
        "may request a refund within 30 days of the original purchase date. Refunds are "
        "processed back to the original payment method once approved. To initiate a refund, "
        "contact support with your order details.\n"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Basic Alchemyst AI RAG demo")
    parser.add_argument("--question", required=True, help="Question to search for")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("ALCHEMYST_AI_API_KEY environment variable is required.", file=sys.stderr)
        return 1

    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID environment variable is required.", file=sys.stderr)
        return 1

    client = AlchemystAI(api_key=api_key)

    policy_text = build_refund_policy()
    file_name = f"refunds-{run_id}.md"

    client.v1.context.add(
        content=policy_text,
        context_type="resource",
        source="documentation",
        scope="internal",
        metadata={
            "file_name": file_name,
            "title": "Refund Policy",
        },
    )

    search_result = client.v1.context.search(
        query=args.question,
        scope="internal",
        similarity_threshold=0.6,
    )

    contexts = getattr(search_result, "contexts", [])
    if not contexts:
        print("No relevant context found for the provided question.")
        return 0

    for context in contexts:
        content = getattr(context, "content", "")
        if content:
            print(content)
        else:
            print("(empty context)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
