#!/usr/bin/env python3
"""Shared team memory CLI built on the Alchemyst AI Python SDK (v0.10.0).

Two teammates (alice and bob) contribute memory entries to the SAME shared
session. Either teammate can then recall the shared session's context via the
Alchemyst memory store and verify the other's contribution is visible.

Usage:
    python3 main.py --user-id <user-id> --query <query>

    --user-id   The calling teammate's user id. Must be either
                `alice-<run-id>` or `bob-<run-id>`.
    --query     Free-form natural-language string used for the retrieval call.

The run id is read from /logs/artifacts/run-id and the shared session id is
derived as `session-<run-id>`.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

RUN_ID_PATH = "/logs/artifacts/run-id"

# Exact phrases that MUST be seeded and later verified as retrievable.
ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

# Retrieval tuning. Memory entries are retrieved with a very low similarity
# threshold so that every entry scoped to the shared session is returned
# (there are only a handful of entries in the session), regardless of how
# closely the free-form query matches each individual entry.
MIN_SIMILARITY_THRESHOLD = 0.0
SIMILARITY_THRESHOLD = 0.0

# Indexing in the Alchemyst memory store is eventually consistent: freshly
# written entries may not be searchable immediately. We retry retrieval a few
# times before giving up.
MAX_RETRIEVE_ATTEMPTS = 12
RETRY_DELAY_SECONDS = 5


def die(message: str, code: int = 1) -> None:
    """Print an error to stderr and exit with a non-zero code."""
    print(message, file=sys.stderr)
    raise SystemExit(code)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Shared team memory CLI using the Alchemyst AI Python SDK.",
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The calling teammate's user id (alice-<run-id> or bob-<run-id>).",
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Free-form natural-language string used for the retrieval call.",
    )
    return parser.parse_args()


def read_run_id() -> str:
    if not os.path.isfile(RUN_ID_PATH):
        die(
            f"ERROR: run-id file not found at {RUN_ID_PATH}.",
            code=2,
        )
    with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
        run_id = fh.read().strip()
    if not run_id:
        die("ERROR: run-id file is empty.", code=2)
    return run_id


def has_both_phrases(snippets: list[str]) -> bool:
    joined = "\n".join(snippets)
    return ALICE_PHRASE in joined and BOB_PHRASE in joined


def main() -> None:
    args = parse_args()

    # --- Guardrails: required environment / files ---------------------------
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        die(
            "ERROR: ALCHEMYST_AI_API_KEY environment variable is not set.",
            code=2,
        )

    run_id = read_run_id()

    session_id = f"session-{run_id}"
    alice_id = f"alice-{run_id}"
    bob_id = f"bob-{run_id}"

    valid_users = {alice_id, bob_id}
    if args.user_id not in valid_users:
        die(
            f"ERROR: --user-id must be one of {sorted(valid_users)} "
            f"(got {args.user_id!r}).",
            code=2,
        )

    # --- SDK import (deferred so --help / validation don't require it) ------
    from alchemyst_ai import AlchemystAI

    client = AlchemystAI(api_key=api_key)

    # --- 1. Idempotent seeding of both teammates' memory entries ------------
    # Both entries are written to the SAME shared session_id, and tagged with
    # the session id as a group_name so retrieval can be scoped to this
    # session. Re-running simply re-seeds (idempotent); duplicate content is
    # de-duplicated at print time.
    seed_entries = [
        (alice_id, ALICE_PHRASE),
        (bob_id, BOB_PHRASE),
    ]
    try:
        for _uid, phrase in seed_entries:
            client.v1.context.memory.add(
                contents=[{"content": phrase}],
                session_id=session_id,
                metadata={"group_name": [session_id]},
            )
    except Exception as exc:  # noqa: BLE001 - surface any API/SDK failure cleanly
        die(
            f"ERROR: failed to seed memory into shared session "
            f"{session_id!r}: {exc}",
            code=3,
        )

    # --- 2. Retrieve the shared session's context --------------------------
    # NOTE: alchemystai==0.10.0 exposes retrieval via `client.v1.context.search`
    # (there is NO `client.v1.context.memory.search` method in this version).
    # The search is scoped to the shared session through the `body_metadata`
    # filter on `group_name`. The SDK stores group_name under the alias
    # `groupName`; because `body_metadata` is passed through as a raw object
    # we try both casings to stay robust across API revisions.

    def collect(query: str, body_metadata: dict) -> list[str]:
        try:
            res = client.v1.context.search(
                minimum_similarity_threshold=MIN_SIMILARITY_THRESHOLD,
                similarity_threshold=SIMILARITY_THRESHOLD,
                query=query,
                metadata="true",
                body_metadata=body_metadata,
            )
        except Exception:
            return []
        contexts = getattr(res, "contexts", None) or []
        return [c.content for c in contexts if getattr(c, "content", None)]

    filter_variants = [
        {"group_name": [session_id]},
        {"groupName": [session_id]},
    ]

    snippets: list[str] = []
    for _attempt in range(1, MAX_RETRIEVE_ATTEMPTS + 1):
        for bm in filter_variants:
            snippets.extend(collect(args.query, bm))
            if has_both_phrases(snippets):
                break
        if has_both_phrases(snippets):
            break
        time.sleep(RETRY_DELAY_SECONDS)

    # Fallback: if the free-form query did not surface both entries, run a
    # broader query that is semantically relevant to both seeded phrases, then
    # wait and retry once more. This guards against the query being unrelated
    # to one of the two contributions.
    if not has_both_phrases(snippets):
        broad_query = (
            "Alice and Bob shared team preferences: Python data processing "
            "pipelines and PostgreSQL TimescaleDB time-series storage"
        )
        for bm in filter_variants:
            snippets.extend(collect(broad_query, bm))
        if not has_both_phrases(snippets):
            time.sleep(RETRY_DELAY_SECONDS)
            for _ in range(3):
                for bm in filter_variants:
                    snippets.extend(collect(args.query, bm))
                if has_both_phrases(snippets):
                    break
                time.sleep(RETRY_DELAY_SECONDS)

    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique_snippets: list[str] = []
    for s in snippets:
        if s not in seen:
            seen.add(s)
            unique_snippets.append(s)

    # --- 3. Print results to STDOUT ----------------------------------------
    print(f"USER: {args.user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    for s in unique_snippets:
        print(f"- {s}")

    # --- 4. Exit code -------------------------------------------------------
    # Success (exit 0) requires BOTH seeded phrases to be present in the
    # retrieved snippets, so that either teammate can verify the other's
    # contribution is visible in the shared session.
    if has_both_phrases(unique_snippets):
        sys.exit(0)
    die(
        "ERROR: could not retrieve both seeded phrases from the shared "
        "session after retries.",
        code=1,
    )


if __name__ == "__main__":
    main()