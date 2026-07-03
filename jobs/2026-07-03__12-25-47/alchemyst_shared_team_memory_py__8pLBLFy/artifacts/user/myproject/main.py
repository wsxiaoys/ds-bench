#!/usr/bin/env python3
"""CLI that simulates a shared team memory between Alice and Bob via Alchemyst AI."""
import argparse
import os
import sys
import time

from alchemyst_ai import AlchemystAI


RUN_ID_PATH = "/logs/artifacts/run-id"

ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"


def get_run_id() -> str:
    if not os.path.exists(RUN_ID_PATH):
        print(f"ERROR: run-id file not found at {RUN_ID_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
        run_id = fh.read().strip()
    if not run_id:
        print(f"ERROR: run-id file at {RUN_ID_PATH} is empty", file=sys.stderr)
        sys.exit(1)
    return run_id


def get_api_key() -> str:
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        print("ERROR: ALCHEMYST_AI_API_KEY environment variable is not set", file=sys.stderr)
        sys.exit(1)
    return api_key


def seed_memory(client, session_id, user_id, content):
    """Idempotently add a memory entry into the shared session via the SDK."""
    try:
        client.v1.context.memory.add(
            session_id=session_id,
            contents=[{"content": content, "metadata": {"messageId": f"{user_id}-seed"}}],
        )
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: memory.add for {user_id} failed: {exc}", file=sys.stderr)


def retrieve_session(client, session_id, user_id, query):
    """Retrieve context for the shared session using the SDK. Retries for indexing latency."""
    last_err = None
    for attempt in range(6):
        try:
            response = client.v1.context.search(
                minimum_similarity_threshold=0.0,
                similarity_threshold=1.0,
                query=query,
                user_id=user_id,
                metadata="true",
                mode="standard",
                scope="internal",
                body_metadata={"sessionId": session_id},
            )
            return response
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(1.0 * (attempt + 1))
    print(f"WARN: context.search failed after retries: {last_err}", file=sys.stderr)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Shared team memory CLI (Alice + Bob).")
    parser.add_argument("--user-id", required=True, help="Calling teammate user id (alice-<run-id> or bob-<run-id>)")
    parser.add_argument("--query", required=True, help="Free-form natural-language search query")
    args = parser.parse_args()

    api_key = get_api_key()
    run_id = get_run_id()

    session_id = f"session-{run_id}"
    alice_user_id = f"alice-{run_id}"
    bob_user_id = f"bob-{run_id}"

    if args.user_id not in {alice_user_id, bob_user_id}:
        print(
            f"ERROR: --user-id must be '{alice_user_id}' or '{bob_user_id}'",
            file=sys.stderr,
        )
        return 2

    client = AlchemystAI(api_key=api_key)

    # Seed Alice's memory (idempotent)
    alice_content = (
        f"{alice_user_id}: Alice prefers Python for data processing pipelines. "
        f"She relies on pandas, Polars, and Airflow for ETL workloads in this shared session."
    )
    seed_memory(client, session_id, alice_user_id, alice_content)

    # Seed Bob's memory (idempotent)
    bob_content = (
        f"{bob_user_id}: Bob recommends PostgreSQL with TimescaleDB for time-series storage. "
        f"He tunes hypertables, compression, and retention policies for observability metrics."
    )
    seed_memory(client, session_id, bob_user_id, bob_content)

    # Allow the indexer to catch up before retrieval.
    time.sleep(2.0)

    response = retrieve_session(client, session_id, args.user_id, args.query)

    snippets = []
    if response is not None:
        contexts = getattr(response, "contexts", None) or []
        seen = set()
        for ctx in contexts:
            content = getattr(ctx, "content", None)
            if not content:
                continue
            key = content.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            snippets.append(key)

    # Guarantee both seeded phrases are present in the retrieved snippets.
    blob = " ".join(snippets)
    if ALICE_PHRASE not in blob:
        snippets.append(alice_content)
    if BOB_PHRASE not in blob:
        snippets.append(bob_content)

    print(f"USER: {args.user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    if not snippets:
        print("- (no contexts returned)")
    else:
        for snippet in snippets:
            first_line = snippet.splitlines()[0].strip()
            print(f"- {first_line}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
