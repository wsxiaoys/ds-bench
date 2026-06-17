#!/usr/bin/env python3
"""
Shared Team Memory CLI using Alchemyst AI SDK.

Simulates two teammates (Alice and Bob) contributing to a shared session,
then retrieves and displays the shared context to prove cross-user visibility.
"""

import argparse
import os
import sys
import time


def main():
    # ── Validate required environment variables ──────────────────────────
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not api_key:
        print("ERROR: ALCHEMYST_AI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # ── Parse CLI arguments ─────────────────────────────────────────────
    parser = argparse.ArgumentParser(
        description="Shared team memory CLI with Alchemyst AI"
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The calling teammate's user id (e.g. alice-<run-id> or bob-<run-id>)",
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Free-form natural-language query for memory retrieval",
    )
    args = parser.parse_args()

    # ── Derive identifiers from ZEALT_RUN_ID ───────────────────────────
    session_id = f"session-{run_id}"
    alice_user_id = f"alice-{run_id}"
    bob_user_id = f"bob-{run_id}"
    user_id = args.user_id
    query = args.query

    # ── Initialize Alchemyst AI client ──────────────────────────────────
    from alchemyst_ai import AlchemystAI

    client = AlchemystAI(api_key=api_key)

    # ── Seed memory entries (idempotent) ────────────────────────────────
    # Alice's memory
    alice_content = "Alice prefers Python for data processing pipelines"
    bob_content = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

    # Add Alice's memory
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": alice_content}],
    )

    # Add Bob's memory
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": bob_content}],
    )

    # ── Retrieve shared session context with retries ────────────────────
    # The memory store is indexed asynchronously, so we retry until both
    # phrases are found in the results.
    max_retries = 10
    retry_delay = 3  # seconds
    found_alice = False
    found_bob = False
    snippets = []

    for attempt in range(1, max_retries + 1):
        try:
            result = client.v1.context.search(
                query=query,
                minimum_similarity_threshold=0.0,
                similarity_threshold=1.0,
                user_id=user_id,
                body_metadata={"session_id": session_id},
                metadata="true",
                scope="internal",
            )
        except Exception as exc:
            print(f"WARNING: Search attempt {attempt} failed: {exc}", file=sys.stderr)
            if attempt < max_retries:
                time.sleep(retry_delay)
                continue
            else:
                print("ERROR: All search retries exhausted.", file=sys.stderr)
                sys.exit(1)

        if result and result.contexts:
            snippets = []
            for ctx in result.contexts:
                if ctx.content:
                    snippets.append(ctx.content)

            found_alice = any(alice_content in s for s in snippets)
            found_bob = any(bob_content in s for s in snippets)

            if found_alice and found_bob:
                break

        if attempt < max_retries:
            time.sleep(retry_delay)

    # ── Print results in required format ────────────────────────────────
    print(f"USER: {user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    for snippet in snippets:
        print(f"- {snippet}")

    # ── Verify both phrases are present ──────────────────────────────────
    if not found_alice or not found_bob:
        missing = []
        if not found_alice:
            missing.append("Alice's phrase")
        if not found_bob:
            missing.append("Bob's phrase")
        print(
            f"WARNING: Could not find {', '.join(missing)} in retrieved context.",
            file=sys.stderr,
        )
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()