#!/usr/bin/env python3
"""Shared Team Memory with Alchemyst AI.

Two teammates (``alice`` and ``bob``) participate in the *same* Alchemyst
session.  On every invocation this CLI:

1.  Ensures both Alice's and Bob's memory entries exist in the shared
    ``session-<run-id>`` (idempotent seeding is used).
2.  Retrieves the shared session's context from the Alchemyst memory store
    via ``client.v1.context.search``.
3.  Prints the retrieved snippets to STDOUT.

Usage::

    python3 main.py --user-id alice-<run-id> --query "<free-form query>"
    python3 main.py --user-id bob-<run-id>   --query "<free-form query>"

The API key is read from the ``ALCHEMYST_AI_API_KEY`` environment variable.
The current run id is read from ``/logs/artifacts/run-id``.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Iterable, List, Optional

from alchemyst_ai import AlchemystAI

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RUN_ID_FILE = "/logs/artifacts/run-id"
API_KEY_ENV = "ALCHEMYST_AI_API_KEY"

# Seed phrases required by the task spec.
ALICE_PHRASE = "Alice prefers Python for data processing pipelines"
BOB_PHRASE = "Bob recommends PostgreSQL with TimescaleDB for time-series storage"

# Retry parameters for retrieval (the store is indexed "shortly after" writes).
SEARCH_MAX_ATTEMPTS = 15
SEARCH_RETRY_DELAY = 2.0  # seconds between attempts

# Lower bound used to keep the similarity window wide enough for new writes
# that may not yet have a strong vector similarity score.
SIM_MIN = 0.0
SIM_MAX = 1.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _die(msg: str, code: int = 2) -> None:
    """Print ``msg`` to STDERR and exit with a non-zero code."""
    sys.stderr.write(f"ERROR: {msg}\n")
    sys.stderr.flush()
    sys.exit(code)


def _read_run_id() -> str:
    """Read and validate the run id from ``RUN_ID_FILE``.

    Exits non-zero if the file is missing or empty.
    """
    if not os.path.isfile(RUN_ID_FILE):
        _die(f"Run id file is missing: {RUN_ID_FILE}", code=3)
    try:
        with open(RUN_ID_FILE, "r", encoding="utf-8") as fh:
            run_id = fh.read().strip()
    except OSError as exc:
        _die(f"Could not read run id file {RUN_ID_FILE}: {exc}", code=3)
    if not run_id:
        _die(f"Run id file is empty: {RUN_ID_FILE}", code=3)
    return run_id


def _require_api_key() -> str:
    """Return the Alchemyst API key from the environment.

    Exits non-zero if it is not present.
    """
    key = os.environ.get(API_KEY_ENV)
    if not key:
        _die(
            f"{API_KEY_ENV} environment variable is not set",
            code=4,
        )
    return key


def _alice_content(run_id: str) -> str:
    """Build the seeded content string for Alice (must contain ``ALICE_PHRASE``)."""
    return (
        f"alice-{run_id}: {ALICE_PHRASE}. "
        f"Session={run_id}. Contributor=alice-{run_id}."
    )


def _bob_content(run_id: str) -> str:
    """Build the seeded content string for Bob (must contain ``BOB_PHRASE``)."""
    return (
        f"bob-{run_id}: {BOB_PHRASE}. "
        f"Session={run_id}. Contributor=bob-{run_id}."
    )


def _search_raw(
    client: AlchemystAI,
    query: str,
    *,
    user_id: str,
    session_id: str,
    metadata: str = "true",
) -> List:
    """Call ``client.v1.context.search`` and return the ``contexts`` list.

    Returns an empty list on error so callers can retry.
    """
    try:
        resp = client.v1.context.search(
            query=query,
            minimum_similarity_threshold=SIM_MIN,
            similarity_threshold=SIM_MAX,
            user_id=user_id,
            metadata=metadata,  # type: ignore[arg-type]
            body_metadata={"session_id": session_id},
        )
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"[warn] context.search failed: {exc}\n")
        sys.stderr.flush()
        return []
    return list(resp.contexts or [])


def _belongs_to_session(ctx, session_id: str, run_id: str) -> bool:
    """Return True if the context item looks like it belongs to ``session_id``.

    The Alchemyst backend stores the session_id in several places on each
    memory entry. We accept any of these as evidence of ownership so that
    the filter is robust against minor schema variations.
    """
    content = ctx.content or ""
    if run_id and run_id in content:
        return True
    if session_id and session_id in content:
        return True

    md = ctx.metadata
    if isinstance(md, dict):
        # file_name is of the form "memory_<session_id>".
        file_name = md.get("file_name") or md.get("fileName")
        if isinstance(file_name, str) and session_id in file_name:
            return True

        # group_name is a list whose entries typically equal the session_id
        # (the server defaults to ["default"] when no group is supplied).
        group_name = md.get("group_name") or md.get("groupName") or []
        if isinstance(group_name, (list, tuple)):
            for g in group_name:
                if isinstance(g, str) and session_id in g:
                    return True
        elif isinstance(group_name, str) and session_id in group_name:
            return True

        # Direct session_id keys (forward-compatibility).
        if md.get("session_id") == session_id:
            return True
        if md.get("sessionId") == session_id:
            return True
    return False


def _session_has_phrase(
    client: AlchemystAI,
    session_id: str,
    run_id: str,
    phrase: str,
    user_id: str,
) -> bool:
    """Return True if ``session_id`` already contains a memory with ``phrase``.

    Other sessions in the shared Alchemyst backend may also contain the same
    phrase (e.g. as part of other tests), so we only count entries that
    actually belong to ``session_id``.
    """
    contexts = _search_raw(
        client,
        phrase,
        user_id=user_id,
        session_id=session_id,
    )
    for ctx in contexts:
        if not _belongs_to_session(ctx, session_id, run_id):
            continue
        if phrase in (ctx.content or ""):
            return True
    return False


def _seed_memories(
    client: AlchemystAI,
    session_id: str,
    run_id: str,
    user_id: str,
) -> None:
    """Idempotently add Alice's and Bob's memory entries to ``session_id``.

    Each call first searches for the canonical seed phrase; if it is not yet
    indexed, the entry is added.  This keeps repeated runs from piling up
    duplicates while still ensuring the entries exist on a cold start.
    """
    # Alice's memory
    if not _session_has_phrase(client, session_id, run_id, ALICE_PHRASE, user_id):
        client.v1.context.memory.add(
            session_id=session_id,
            contents=[{"content": _alice_content(run_id)}],
        )

    # Bob's memory
    if not _session_has_phrase(client, session_id, run_id, BOB_PHRASE, user_id):
        client.v1.context.memory.add(
            session_id=session_id,
            contents=[{"content": _bob_content(run_id)}],
        )


def _retrieve_with_retry(
    client: AlchemystAI,
    query: str,
    session_id: str,
    run_id: str,
    user_id: str,
) -> List:
    """Search the session repeatedly until BOTH seed phrases are visible.

    The memory store is indexed asynchronously after writes, so we retry
    with a generous back-off.  To guarantee that BOTH seed phrases are
    included regardless of the user's query, we run two extra targeted
    searches (one per seed phrase) on top of the user's query and merge
    the results.  Returns whatever contexts we were able to retrieve
    (possibly empty) after the last attempt.
    """
    targeted_queries = [ALICE_PHRASE, BOB_PHRASE]
    last_by_query: dict[str, List] = {}

    def _all_session_contexts() -> List:
        merged: List = []
        seen_ids: set = set()
        for ctxs in last_by_query.values():
            for ctx in ctxs:
                if not _belongs_to_session(ctx, session_id, run_id):
                    continue
                # Deduplicate by object identity (each retrieval returns
                # distinct pydantic instances).
                key = id(ctx)
                if key in seen_ids:
                    continue
                seen_ids.add(key)
                merged.append(ctx)
        return merged

    for attempt in range(1, SEARCH_MAX_ATTEMPTS + 1):
        # Issue every targeted query on each attempt — the user query is
        # only included on the first attempt since it doesn't change.
        queries_this_attempt: List[str] = []
        if attempt == 1:
            queries_this_attempt.append(query)
        queries_this_attempt.extend(targeted_queries)

        for q in queries_this_attempt:
            contexts = _search_raw(
                client,
                q,
                user_id=user_id,
                session_id=session_id,
            )
            last_by_query[q] = contexts

        in_session = _all_session_contexts()
        joined = "\n".join((c.content or "") for c in in_session)
        have_alice = ALICE_PHRASE in joined
        have_bob = BOB_PHRASE in joined
        sys.stderr.write(
            f"[info] retrieval attempt {attempt}/{SEARCH_MAX_ATTEMPTS}: "
            f"in_session={len(in_session)} have_alice={have_alice} "
            f"have_bob={have_bob}\n"
        )
        sys.stderr.flush()

        if have_alice and have_bob and in_session:
            return in_session

        # On a cold start the very first search may return nothing while the
        # memory writes are still being indexed; wait a bit and try again.
        time.sleep(SEARCH_RETRY_DELAY)

    # Fall back to whatever we managed to retrieve across all queries,
    # filtered to this session where possible.
    final = _all_session_contexts()
    if final:
        return final
    # Last-ditch fallback: return everything we retrieved, unfiltered.
    flat: List = []
    for ctxs in last_by_query.values():
        flat.extend(ctxs)
    return flat


def _format_snippets(contexts: Iterable) -> List[str]:
    """Produce a deduplicated, ordered list of snippet strings for printing."""
    seen = set()
    out: List[str] = []
    for ctx in contexts:
        text = (ctx.content or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description=(
            "Seed Alice's and Bob's shared Alchemyst session and recall "
            "its context."
        ),
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The calling teammate's id (alice-<run-id> or bob-<run-id>).",
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Free-form natural-language retrieval query.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)

    # --- preconditions --------------------------------------------------
    run_id = _read_run_id()
    _require_api_key()  # validated even though the SDK would also read it

    session_id = f"session-{run_id}"
    alice_id = f"alice-{run_id}"
    bob_id = f"bob-{run_id}"

    if args.user_id not in (alice_id, bob_id):
        _die(
            f"--user-id must be '{alice_id}' or '{bob_id}', got '{args.user_id}'",
            code=5,
        )

    # The SDK reads ALCHEMYST_AI_API_KEY from the environment REDACTEDmatically;
    # we pass it explicitly here to keep behaviour obvious and predictable.
    client = AlchemystAI(api_key=os.environ[API_KEY_ENV])

    # --- seed memories (idempotent) ------------------------------------
    _seed_memories(client, session_id, run_id, args.user_id)

    # --- retrieve shared session context ------------------------------
    contexts = _retrieve_with_retry(
        client,
        args.query,
        session_id,
        run_id,
        args.user_id,
    )
    snippets = _format_snippets(contexts)

    # --- emit STDOUT in the required format ---------------------------
    print(f"USER: {args.user_id}")
    print(f"SESSION: {session_id}")
    print("RETRIEVED:")
    if not snippets:
        print("- (no snippets returned)")
    for snippet in snippets:
        print(f"- {snippet}")

    return 0


if __name__ == "__main__":
    sys.exit(main())