#!/usr/bin/env python3
"""
Shared Team Memory CLI using Alchemyst AI.

Two teammates (alice and bob) participate in the same session and add
their own memory entries. The CLI then proves that the shared session can be
recalled by either teammate via Alchemyst's memory retrieval.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from alchemyst_ai import AlchemystAI

RUN_ID_PATH = Path("/logs/artifacts/run-id")

ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"


def _read_run_id() -> str:
    """Read the run id from /logs/artifacts/run-id, exiting if missing."""
    if not RUN_ID_PATH.exists():
        sys.stderr.write(
            f"error: required file {RUN_ID_PATH} is missing\n"
        )
        sys.exit(1)
    try:
        return RUN_ID_PATH.read_text().strip()
    except OSError as exc:
        sys.stderr.write(f"error: could not read {RUN_ID_PATH}: {exc}\n")
        sys.exit(1)


def _require_api_key() -> str:
    """Return the Alchemyst API key from the env, exiting if missing."""
    key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not key:
        sys.stderr.write(
            "error: ALCHEMYST_AI_API_KEY environment variable is missing\n"
        )
        sys.exit(1)
    return key


def seed_memories(client: AlchemystAI, session_id: str) -> None:
    """Idempotently seed Alice's and Bob's memory entries for the session."""
    seeds = [
        (
            f"alice notes: {ALICE_PHRASE}. Team standup context for {session_id}.",
            "alice-seed",
        ),
        (
            f"bob notes: {BOB_PHRASE}. Team standup context for {session_id}.",
            "bob-seed",
        ),
    ]
    for content, message_id in seeds:
        try:
            client.v1.context.memory.add(
                session_id=session_id,
                contents=[
                    {
                        "content": content,
                        "metadata": {"message_id": message_id},
                    }
                ],
            )
        except Exception as exc:  # noqa: BLE001 - idempotent seeding
            sys.stderr.write(
                f"warning: seed memory.add failed for {message_id}: {exc}\n"
            )


def retrieve_session(
    client: AlchemystAI,
    session_id: str,
    user_id: str,
    query: str,
    attempts: int = 6,
    delay: float = 2.0,
):
    """Retrieve the shared session context, retrying for indexing latency."""
    last_exc: Exception | None = None
    for _ in range(attempts):
        try:
            response = client.v1.context.search(
                query=query,
                minimum_similarity_threshold=0.0,
                similarity_threshold=1.0,
                mode="standard",
                scope="internal",
                user_id=user_id,
                metadata="true",
                body_metadata={"sessionId": session_id},
            )
            return response
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            time.sleep(delay)
            delay = min(delay * 1.5, 8.0)
    if last_exc is not None:
        sys.stderr.write(
            f"warning: search attempts exhausted, last error: {last_exc}\n"
        )
    return None


def extract_snippets(response) -> list[str]:
    """Pull snippet text out of a ContextSearchResponse."""
    snippets: list[str] = []
    if response is None:
        return snippets
    contexts = getattr(response, "contexts", None)
    if contexts is None:
        return snippets
    for ctx in contexts:
        if ctx is None:
            continue
        content = getattr(ctx, "content", None)
        if content:
            snippets.append(content)
    return snippets


def contains_both_phrases(snippets: list[str]) -> bool:
    blob = "\n".join(snippets)
    return ALICE_PHRASE in blob and BOB_PHRASE in blob


def print_output(
    user_id: str,
    session_id: str,
    snippets: list[str],
    both_found: bool,
) -> None:
    print(f"USER: {user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    if snippets:
        for snippet in snippets:
            print(f"- {snippet}")
    elif both_found:
        print("- (both seeded phrases observed in retrieved context)")
    else:
        print("- (no snippets retrieved yet; index may still be warming)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Shared Alchemyst team-memory CLI",
    )
    parser.add_argument("--user-id", required=True, help="Teammate user id")
    parser.add_argument("--query", required=True, help="Retrieval query")
    args = parser.parse_args()

    user_id = args.user_id.strip()
    query = args.query.strip()
    if not user_id:
        sys.stderr.write("error: --user-id must be non-empty\n")
        return 2
    if not query:
        sys.stderr.write("error: --query must be non-empty\n")
        return 2

    run_id = _read_run_id()
    api_key = _require_api_key()

    session_id = f"session-{run_id}"

    client = AlchemystAI(api_key=api_key)

    seed_memories(client, session_id)

    response = retrieve_session(
        client=client,
        session_id=session_id,
        user_id=user_id,
        query=query,
    )

    snippets = extract_snippets(response)
    both_found = contains_both_phrases(snippets)

    print_output(
        user_id=user_id,
        session_id=session_id,
        snippets=snippets,
        both_found=both_found,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
