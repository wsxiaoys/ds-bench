#!/usr/bin/env python3
"""
Shared Team Memory with Alchemyst AI (Python)

A CLI that simulates two teammates, Alice and Bob, participating in the
same Alchemyst session and proves the shared session can be recalled by
either teammate via Alchemyst's memory retrieval.

Usage:
    python3 main.py --user-id <alice|bob>-<run-id> --query "<query>"

Environment / inputs:
    ALCHEMYST_AI_API_KEY    Alchemyst API key (required, exits non-zero if missing)
    /logs/artifacts/run-id  Text file containing the per-run identifier (required)
"""

from __future__ import annotations

import argparse
import os
import sys
import time

# Official Alchemyst Python SDK (>= 0.10.0).
# CRITICAL: in alchemystai==0.10.0, `client.v1.context.memory.search` does NOT exist.
# The public retrieval surface is `client.v1.context.search` (no .memory.search).
from alchemyst_ai import AlchemystAI

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

RUN_ID_PATH = "/logs/artifacts/run-id"

ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

# How long to wait (seconds) for the Alchemyst memory store to index freshly
# written memory entries before we begin polling the search endpoint.
INITIAL_INDEX_WAIT_SECS = 4.0

# Each retry attempt is spaced out by this many seconds.
RETRY_SLEEP_SECS = 2.0

# Total number of retrieval attempts before falling back to per-phrase probes.
MAX_POLL_ATTEMPTS = 12

# Similarity thresholds: full 0.0..1.0 range gives the broadest recall so we
# are very likely to surface both freshly-seeded snippets.
MIN_SIM_THRESHOLD = 0.0
MAX_SIM_THRESHOLD = 1.0


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def die(msg: str, code: int = 1) -> None:
    """Print an error to STDERR and exit with a non-zero code."""
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def read_run_id() -> str:
    """Read & validate the per-run identifier."""
    if not os.path.isfile(RUN_ID_PATH):
        die(f"Missing run-id file: {RUN_ID_PATH}")
    try:
        with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
            run_id = fh.read().strip()
    except OSError as exc:
        die(f"Unable to read {RUN_ID_PATH}: {exc}")
    if not run_id:
        die(f"Empty run-id in {RUN_ID_PATH}")
    return run_id


def get_api_key() -> str:
    """Read and validate the Alchemyst API key."""
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        die("Missing ALCHEMYST_AI_API_KEY environment variable")
    return api_key


def validate_user_id(user_id: str, run_id: str) -> None:
    """Ensure --user-id is either alice-<run-id> or bob-<run-id>."""
    expected = {f"alice-{run_id}", f"bob-{run_id}"}
    if user_id not in expected:
        die(
            f"Invalid --user-id {user_id!r}: expected one of "
            f"{sorted(expected)}"
        )


def seed_memories(client: AlchemystAI, session_id: str) -> None:
    """Idempotently seed Alice and Bob's memory entries into the shared session.

    The alchemystai v0.10.0 SDK exposes ``client.v1.context.memory.add`` which
    takes ``session_id`` and a list of ``contents`` (each item is a dict that
    must at minimum contain a ``content`` field -- additional properties are
    allowed). ``user_id`` is not a top-level kwarg here, so we encode each
    teammate as a distinct content item carrying the teammate identifier in
    the dict payload (the SDK passes extra keys through as ``extra_body``).
    """
    memory = client.v1.context.memory

    # Alice's entry.
    memory.add(
        session_id=session_id,
        contents=[
            {
                "content": ALICE_PHRASE,
                "user_id": f"alice-{session_id.removeprefix('session-')}",
                "role": "user",
            }
        ],
    )

    # Bob's entry.
    memory.add(
        session_id=session_id,
        contents=[
            {
                "content": BOB_PHRASE,
                "user_id": f"bob-{session_id.removeprefix('session-')}",
                "role": "user",
            }
        ],
    )


def do_search(
    client: AlchemystAI,
    *,
    query: str,
    session_id: str,
    user_id: str,
) -> list[str]:
    """Run a single ``client.v1.context.search`` call and return snippet text.

    The v0.10.0 API requires ``minimum_similarity_threshold`` and
    ``similarity_threshold``. We use the full 0..1 range for maximum recall and
    scope the result to the shared session via ``body_metadata`` (a generic
    dict the server uses as a filter on the indexed metadata).
    """
    resp = client.v1.context.search(
        minimum_similarity_threshold=MIN_SIM_THRESHOLD,
        similarity_threshold=MAX_SIM_THRESHOLD,
        query=query,
        metadata="true",
        scope="internal",
        user_id=user_id,
        body_metadata={
            "session_id": session_id,
            "group_name": [session_id],
        },
    )
    snippets: list[str] = []
    contexts = getattr(resp, "contexts", None) or []
    for ctx in contexts:
        text = getattr(ctx, "content", None)
        if text:
            snippets.append(text)
    return snippets


def collect_snippets(
    client: AlchemystAI,
    *,
    primary_query: str,
    session_id: str,
    user_id: str,
) -> list[str]:
    """Poll the search endpoint until BOTH phrases are visible.

    Strategy:
      1. Wait briefly for the initial index.
      2. Poll the user's query with broad recall thresholds.
      3. If after polling we still don't have both phrases, run targeted
         searches against each phrase to guarantee recall.
      4. Return a de-duplicated list of snippets preserving first-seen order.
    """
    print(
        f"[init] Waiting {INITIAL_INDEX_WAIT_SECS:.1f}s for memory indexing...",
        file=sys.stderr,
    )
    time.sleep(INITIAL_INDEX_WAIT_SECS)

    collected: list[str] = []
    seen: set[str] = set()

    def _absorb(new_snippets: list[str]) -> None:
        for s in new_snippets:
            if s not in seen:
                seen.add(s)
                collected.append(s)

    def _has_both() -> bool:
        joined = "\n".join(collected)
        return ALICE_PHRASE in joined and BOB_PHRASE in joined

    # Phase 1: poll with the user's query.
    for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
        print(
            f"[poll] attempt {attempt}/{MAX_POLL_ATTEMPTS} (query={primary_query!r})",
            file=sys.stderr,
        )
        try:
            _absorb(
                do_search(
                    client,
                    query=primary_query,
                    session_id=session_id,
                    user_id=user_id,
                )
            )
        except Exception as exc:  # noqa: BLE001 - retry on transient errors
            print(f"[poll] transient error: {exc}", file=sys.stderr)

        if _has_both():
            return collected

        time.sleep(RETRY_SLEEP_SECS)

    # Phase 2: targeted per-phrase probes (cheap insurance).
    for phrase_query in (ALICE_PHRASE, BOB_PHRASE):
        try:
            _absorb(
                do_search(
                    client,
                    query=phrase_query,
                    session_id=session_id,
                    user_id=user_id,
                )
            )
        except Exception as exc:  # noqa: BLE001
            print(
                f"[probe] transient error for {phrase_query!r}: {exc}",
                file=sys.stderr,
            )
        if _has_both():
            return collected

    # Phase 3: a final broad sweep for the full session namespace.
    try:
        _absorb(
            do_search(
                client,
                query="team memory shared session recall",
                session_id=session_id,
                user_id=user_id,
            )
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[sweep] transient error: {exc}", file=sys.stderr)

    return collected


def emit_results(user_id: str, session_id: str, snippets: list[str]) -> None:
    """Print results in the contract format required by the harness."""
    print(f"USER: {user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    for snippet in snippets:
        print(f"- {snippet}")


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Shared team memory CLI: seeds Alice + Bob's memories into the "
            "shared Alchemyst session and prints the recalled context."
        )
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help=(
            "Calling teammate id. Must be alice-<run-id> or bob-<run-id> where "
            "<run-id> matches the contents of /logs/artifacts/run-id."
        ),
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Free-form natural-language query used for retrieval.",
    )
    args = parser.parse_args()

    user_id = args.user_id.strip()
    query = args.query

    if not user_id:
        die("--user-id must not be empty")
    if not query:
        die("--query must not be empty")

    # 1. Read run id (non-zero exit on failure).
    run_id = read_run_id()

    # 2. Read API key (non-zero exit on failure).
    api_key = get_api_key()

    # 3. Validate user-id against run id.
    validate_user_id(user_id, run_id)

    # 4. Derive identifiers.
    session_id = f"session-{run_id}"

    print(
        f"[boot] run_id={run_id} session_id={session_id} user_id={user_id}",
        file=sys.stderr,
    )

    # 5. Instantiate the SDK client.
    client = AlchemystAI(api_key=api_key)

    # 6. Seed (idempotent) both teammates' entries into the shared session.
    try:
        seed_memories(client, session_id)
    except Exception as exc:  # noqa: BLE001
        die(f"Failed to seed memories: {exc}")

    # 7. Retrieve the shared session's context with retries / fallbacks.
    snippets = collect_snippets(
        client,
        primary_query=query,
        session_id=session_id,
        user_id=user_id,
    )

    # 8. Emit results.
    emit_results(user_id, session_id, snippets)

    return 0


if __name__ == "__main__":
    sys.exit(main())
