import os
import sys
import argparse
import datetime
from alchemyst_ai import AlchemystAI

def main():
    # 1. Parse command line arguments
    parser = argparse.ArgumentParser(description="Alchemyst AI Basic RAG Flow")
    parser.add_argument("--question", required=True, help="The question to search the context engine for")
    args = parser.parse_args()

    # 2. Read the ALCHEMYST_AI_API_KEY from environment variables
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # 3. Read the run ID from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: Run ID file not found at {run_id_path}", file=sys.stderr)
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()

    if not run_id:
        print("Error: Run ID is empty.", file=sys.stderr)
        sys.exit(1)

    # 4. Initialize the AlchemystAI client
    client = AlchemystAI(api_key=api_key)

    # 5. Define the 30-day refund policy document content
    policy_content = """# Refund Policy

We offer a 30-day refund policy for all our products. If you are not completely satisfied with your purchase, you can request a full refund within 30 days of the purchase date.

To be eligible for a refund, please ensure that:
- The product was purchased in the last 30 days.
- You have the receipt or proof of purchase.
- The product is not damaged.

Refunds will be processed back to the original method of payment. Please allow 5-10 business days for the refund to appear on your statement.

If you have any questions about our Refund Policy, please contact us at support@example.com."""

    file_name = f"refunds-{run_id}.md"
    content_size = len(policy_content.encode("utf-8"))
    last_modified_str = datetime.datetime.now().isoformat()

    # 6. Add the single policy document to the Alchemyst context engine
    try:
        client.v1.context.add(
            context_type="resource",
            documents=[
                {
                    "content": policy_content
                }
            ],
            scope="internal",
            source="documentation",
            metadata={
                "file_name": file_name,
                "file_type": "markdown",
                "file_size": content_size,
                "last_modified": last_modified_str
            }
        )
    except Exception as e:
        print(f"Error adding document to context engine: {e}", file=sys.stderr)
        sys.exit(1)

    # 7. Search the context engine for the user's question
    try:
        results = client.v1.context.search(
            query=args.question,
            similarity_threshold=0.7,
            minimum_similarity_threshold=0.5,
            scope="internal",
            body_metadata={
                "file_name": file_name
            }
        )
    except Exception as e:
        print(f"Error searching context engine: {e}", file=sys.stderr)
        sys.exit(1)

    # 8. Print retrieved chunks to stdout
    if results.contexts:
        for ctx in results.contexts:
            if ctx.content:
                print(ctx.content)
    else:
        print("No contexts returned")

if __name__ == "__main__":
    main()
