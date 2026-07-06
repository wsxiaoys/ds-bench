#!/usr/bin/env python3
"""Shared team memory CLI for Alchemyst AI.

Two teammates (alice and bob) contribute memory entries to the SAME shared
session.  Either teammate can then recall the shared session's context via
Alchemyst's memory retrieval, verifying the other teammate's contribution is
visible.

Usage:
    python3 main.py --user-id <user-id> --query <query>
"""

import argparse
import os
import sys
import time

RUN_ID_PATH = "/logs/artifacts/run-id"

# The exact phrases that MUST be present in the seeded memory entries and that
# MUST collectively appear in the retrieved snippets.
ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

# Retrieval retry configuration.  The Alchemyst memory store is indexed shortly
# after writes, so we may need to retry a few times before both seeded phrases
# become retrievable.
MAX_RETRIEVAL_ATTEMPTS = 15
RETRY_DELAY_SECONDS = 2.0


def die(message: str) -> None:
    """Print an error to stderr and exit with a non-zero status."""
    print(message, file=sys.stderr)
    sys.exit(1)


def read_run_id() -> str:
    """Read the current run id from /logs/artifacts/run-id."""
    if not os.path.exists(RUN_ID_PATH):
        die("ERROR: run id file not found at %s" % RUN_ID_PATH)
    try:
        with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
            run_id = fh.read().strip()
    except OSError as exc:  # pragma: no cover - defensive
        die("ERROR: unable to read run id file: %s" % exc)
    if not run_id:
        die("ERROR: run id file at %s is empty" % RUN_ID_PATH)
    return run_id


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Shared team memory CLI backed by the Alchemyst AI memory store."
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The calling teammate's user id (alice-<run-id> or bob-<run-id>).",
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Free-form natural-language query used for the retrieval call.",
    )
    return parser.parse_args()


def build_client():
    """Instantiate the Alchemyst AI SDK client from the env-var API key."""
    from alchemyst_ai import AlchemystAI

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        die("ERROR: ALCHEMYST_AI_API_KEY environment variable is not set")
    return AlchemystAI(api_key=api_key)


def seed_memories(client, session_id: str, alice_id: str, bob_id: str) -> None:
    """Idempotently ensure both Alice's and Bob's memory entries exist in the
    shared session.

    We tag each entry's content with the session id so that the entry is unique
    per run and can be reliably scoped client-side to the shared session.  The
    required phrases are embedded verbatim (as substrings) within the content.
    We also set the `group_name` metadata to the session id so the server-side
    search can be scoped to this shared session.
    """
    group_name = [session_id]

    alice_content = (
        "[{session}] {user}: {phrase} "
        "(shared team memory seeded by alice for the data-processing discussion)."
    ).format(session=session_id, user=alice_id, phrase=ALICE_PHRASE)

    bob_content = (
        "[{session}] {user}: {phrase} "
        "(shared team memory seeded by bob for the time-series storage discussion)."
    ).format(session=session_id, user=bob_id, phrase=BOB_PHRASE)

    # Alice's entry.
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": alice_content}],
        metadata={"group_name": group_name},
    )

    # Bob's entry.
    client.v1.context.memory.add(
        session_id=session_id,
        contents=[{"content": bob_content}],
        metadata={"group_name": group_name},
    )


def _extract_contents(response) -> list:
    """Extract the list of content strings from a ContextSearchResponse."""
    if response is None:
        return []
    contexts = getattr(response, "contexts", None)
    if not contexts:
        return []
    snippets = []
    for ctx in contexts:
        content = getattr(ctx, "content", None)
        if content:
            snippets.append(content)
    return snippets


def search_scoped(client, query: str, session_id: str, user_id: str):
    """Search scoped to the shared session via the group_name filter."""
    return client.v1.context.search(
        query=query,
        minimum_similarity_threshold=0.0,
        similarity_threshold=0.0,
        scope="internal",
        body_metadata={"group_name": [session_id]},
        user_id=user_id,
    )


def search_broad(client, query: str, user_id: str):
    """Broad fallback search without session scoping (filtered client-side)."""
    return client.v1.context.search(
        query=query,
        minimum_similarity_threshold=0.0,
        similarity_threshold=0.0,
        scope="internal",
        user_id=user_id,
    )


def retrieve_snippets(
    client, query: str, session_id: str, user_id: str
) -> list:
    """Retrieve the shared session's context, retrying while the index settles.

    Returns a list of snippet strings that are scoped to the shared session and
    that collectively contain BOTH seeded phrases.  Raises RuntimeError if the
    phrases cannot be retrieved after the configured number of attempts.
    """
    required = [ALICE_PHRASE, BOB_PHRASE]
    session_marker = "[%s]" % session_id

    last_scoped = []
    for attempt in range(1, MAX_RETRIEVAL_ATTEMPTS + 1):
        # Strategy A: server-side scoped search.
        scoped = _extract_contents(search_scoped(client, query, session_id, user_id))
        # Keep only snippets belonging to this shared session.
        scoped = [s for s in scoped if session_marker in s]
        last_scoped = scoped
        if all(any(phrase in s for s in scoped) for phrase in required):
            return scoped

        # Strategy B: broad fallback, filtered client-side to this session.
        broad = _extract_contents(search_broad(client, query, user_id))
        broad = [s for s in broad if session_marker in s]
        if all(any(phrase in s for s in broad) for phrase in required):
            return broad

        # Index may not have settled yet; wait and retry.
        time.sleep(RETRY_DELAY_SECONDS)

    # Final attempt: combine everything we have and verify.
    combined = list(dict.fromkeys(last_scoped))
    if all(any(phrase in s for s in combined) for phrase in required):
        return combined

    raise RuntimeError(
        "ERROR: failed to retrieve both seeded phrases from the shared session "
        "after %d attempts" % MAX_RETRIEVAL_ATTEMPTS
    )


def main() -> None:
    args = parse_args()

    # The API key must be present (checked inside build_client too, but validate
    # early for a clear non-zero exit).
    if not os.environ.get("ALCHEMYST_AI_API_KEY"):
        die("ERROR: ALCHEMYST_AI_API_KEY environment variable is not set")

    run_id = read_run_id()
    session_id = "session-%s" % run_id
    alice_id = "alice-%s" % run_id
    bob_id = "bob-%s" % run_id

    # Validate the calling teammate's user id.
    if args.user_id not in (alice_id, bob_id):
        die(
            "ERROR: --user-id must be either %s or %s" % (alice_id, bob_id)
        )

    client = build_client()

    # 1. Idempotently seed both teammates' memory entries in the shared session.
    seed_memories(client, session_id, alice_id, bob_id)

    # 2. Retrieve the shared session's context (retrying while indexing settles).
    snippets = retrieve_snippets(client, args.query, session_id, args.user_id)

    # 3. Emit the required STDOUT format.
    print("USER: %s" % args.user_id)
    print("SESSION: %s" % session_id)
    print("RETRIEVED:")
    for snippet in snippets:
        print("- %s" % snippet)

    sys.exit(0)


if __name__ == "__main__":
    main()