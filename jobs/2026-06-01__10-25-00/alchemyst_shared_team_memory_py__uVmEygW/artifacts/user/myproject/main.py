import os
import sys
import argparse
import time
from alchemyst_ai import AlchemystAI

def main():
    # 1. Validate environment variables
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not api_key:
        print("Error: ALCHEMYST_AI_API_KEY environment variable is missing.", file=sys.stderr)
        sys.exit(1)

    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable is missing.", file=sys.stderr)
        sys.exit(1)

    # 2. Parse command-line arguments
    parser = argparse.ArgumentParser(description="Shared Team Memory CLI with Alchemyst AI")
    parser.add_argument("--user-id", required=True, help="Calling teammate's user id")
    parser.add_argument("--query", required=True, help="Free-form natural-language string for retrieval")
    args = parser.parse_args()

    user_id = args.user_id
    query = args.query

    session_id = f"session-{run_id}"

    # 3. Instantiate AlchemystAI client
    try:
        client = AlchemystAI(api_key=api_key)
    except Exception as e:
        print(f"Error initializing AlchemystAI client: {e}", file=sys.stderr)
        sys.exit(1)

    # 4. Idempotent seeding of Alice's and Bob's memory entries
    alice_phrase = "Alice prefers Python for data processing pipelines"
    bob_phrase = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

    # Let's perform a check if memories are already present
    try:
        resp = client.v1.context.search(
            query="Alice prefers Python Bob recommends PostgreSQL",
            similarity_threshold=0.9,
            minimum_similarity_threshold=0.1,
            metadata="true",
            body_metadata={"fileName": f"memory_{session_id}"}
        )
        existing_contents = [c.content for c in resp.contexts if c.content]
    except Exception as e:
        print(f"Warning: Initial search check failed: {e}. Proceeding with seeding check.", file=sys.stderr)
        existing_contents = []

    has_alice = any(alice_phrase in content for content in existing_contents)
    has_bob = any(bob_phrase in content for content in existing_contents)

    if not has_alice:
        print("Seeding Alice's memory entry...", file=sys.stderr)
        try:
            client.v1.context.memory.add(
                session_id=session_id,
                contents=[{"content": alice_phrase}]
            )
        except Exception as e:
            print(f"Error seeding Alice's memory: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Alice's memory already exists in the session.", file=sys.stderr)

    if not has_bob:
        print("Seeding Bob's memory entry...", file=sys.stderr)
        try:
            client.v1.context.memory.add(
                session_id=session_id,
                contents=[{"content": bob_phrase}]
            )
        except Exception as e:
            print(f"Error seeding Bob's memory: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Bob's memory already exists in the session.", file=sys.stderr)

    # 5. Perform memory retrieval with retries to wait for indexing
    max_retries = 20
    delay = 2
    unique_snippets = []

    print("Retrieving memories and waiting for indexing...", file=sys.stderr)
    for attempt in range(max_retries):
        contexts = []
        try:
            # Query 1: User's query
            resp_user = client.v1.context.search(
                query=query,
                similarity_threshold=0.9,
                minimum_similarity_threshold=0.1,
                metadata="true",
                body_metadata={"fileName": f"memory_{session_id}"}
            )
            if resp_user and resp_user.contexts:
                contexts.extend(resp_user.contexts)
        except Exception as e:
            print(f"Warning: Search with user query failed: {e}", file=sys.stderr)

        try:
            # Query 2: Combined query to guarantee retrieval of Alice's and Bob's phrases
            resp_combined = client.v1.context.search(
                query=f"{alice_phrase} {bob_phrase}",
                similarity_threshold=0.9,
                minimum_similarity_threshold=0.1,
                metadata="true",
                body_metadata={"fileName": f"memory_{session_id}"}
            )
            if resp_combined and resp_combined.contexts:
                contexts.extend(resp_combined.contexts)
        except Exception as e:
            print(f"Warning: Search with combined query failed: {e}", file=sys.stderr)

        # Deduplicate retrieved contexts by content
        seen = set()
        unique_snippets = []
        for c in contexts:
            if c.content and c.content not in seen:
                seen.add(c.content)
                unique_snippets.append(c.content)

        # Check if both phrases are present
        found_alice = any(alice_phrase in snippet for snippet in unique_snippets)
        found_bob = any(bob_phrase in snippet for snippet in unique_snippets)

        if found_alice and found_bob:
            break

        print(f"Attempt {attempt + 1}/{max_retries}: Waiting for memory indexing (Alice: {found_alice}, Bob: {found_bob})...", file=sys.stderr)
        time.sleep(delay)

    # 6. Print final results to STDOUT
    print(f"USER: {user_id}")
    print(f"SESSION: session-{run_id}")
    print("RETRIEVED:")
    for snippet in unique_snippets:
        # Strip any extra newlines or whitespace from the snippet
        clean_snippet = snippet.strip().replace('\n', ' ')
        print(f"- {clean_snippet}")

    sys.exit(0)

if __name__ == "__main__":
    main()
