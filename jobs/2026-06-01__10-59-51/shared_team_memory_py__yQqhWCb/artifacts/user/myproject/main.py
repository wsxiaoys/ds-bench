import os
import sys
import time
import argparse
from alchemyst_ai import AlchemystAI

def main():
    parser = argparse.ArgumentParser(description="Shared Team Memory CLI")
    parser.add_argument("--user-id", required=True, help="The calling teammate's user id")
    parser.add_argument("--query", required=True, help="Free-form natural-language string for retrieval")
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY is missing", file=sys.stderr)
        sys.exit(1)
    if not run_id:
        print("Error: ZEALT_RUN_ID is missing", file=sys.stderr)
        sys.exit(1)

    session_id = f"session-{run_id}"
    alice_id = f"alice-{run_id}"
    bob_id = f"bob-{run_id}"

    if args.user_id not in (alice_id, bob_id):
        print(f"Error: --user-id must be either {alice_id} or {bob_id}", file=sys.stderr)
        sys.exit(1)

    client = AlchemystAI(api_key=api_key)

    # Seed Alice's memory
    # Seeding MUST be idempotent so the CLI can be re-run safely.
    alice_phrase = f"Alice prefers Python for data processing pipelines (run: {run_id})"
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": alice_phrase}]
    )

    # Seed Bob's memory
    bob_phrase = f"Bob recommends PostgreSQL with TimescaleDB for time-series storage (run: {run_id})"
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": bob_phrase}]
    )

    # Search
    # The Alchemyst memory store is indexed shortly after writes
    max_retries = 15
    retrieved_snippets = []

    for attempt in range(max_retries):
        res = client.v1.context.search(
            minimum_similarity_threshold=0.0,
            similarity_threshold=1.0,
            query=args.query,
            user_id=args.user_id,
            body_metadata={"session_id": session_id},
            metadata="true"
        )
        
        current_snippets = []
        for c in res.contexts:
            if c.metadata and c.metadata.get("file_name") == f"memory_{session_id}":
                current_snippets.append(c.content)
        
        has_alice = any("Alice prefers Python" in s for s in current_snippets)
        has_bob = any("Bob recommends PostgreSQL" in s for s in current_snippets)
        
        if has_alice and has_bob:
            retrieved_snippets = current_snippets
            break
            
        time.sleep(2)

    if not retrieved_snippets:
        retrieved_snippets = current_snippets

    print(f"USER: {args.user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    for snippet in retrieved_snippets:
        clean_snippet = snippet.replace('\n', ' ').strip()
        print(f"- {clean_snippet}")

if __name__ == "__main__":
    main()
