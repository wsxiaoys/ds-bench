import os
import argparse
import sys
from alchemyst_ai import AlchemystAI

def main():
    parser = argparse.ArgumentParser(description="Alchemyst AI Basic RAG Flow")
    parser.add_argument("--question", required=True, type=str, help="The user question to search for")
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    file_name = f"refunds-{run_id}.md"

    # Initialize the client
    client = AlchemystAI(api_key=api_key)

    # 1. Add document
    try:
        client.v1.context.add(
            documents=[{
                "content": "Our refund policy: We offer a 30-day money back guarantee. Contact support@example.com to request a refund.",
                "metadata": {
                    "file_name": file_name
                }
            }],
            context_type="resource",
            source="documentation",
            scope="internal"
        )
    except Exception as e:
        print(f"Error adding document: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Search context
    try:
        result = client.v1.context.search(
            query=args.question,
            similarity_threshold=0.5,
            scope="internal"
        )
        
        contexts = result.contexts or []
        
        if not contexts:
            print("No relevant contexts found.")
        else:
            for i, ctx in enumerate(contexts):
                print(f"Context {i+1}: {ctx.content}")
                
    except Exception as e:
        print(f"Error searching context: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
