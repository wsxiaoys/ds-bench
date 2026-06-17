#!/usr/bin/env python3
"""Context Arithmetic (Intersection) demo using the Alchemyst AI Python SDK.

Ingests three documents whose ``group_name`` arrays overlap, then performs a
filtered search via ``client.v1.context.search`` with ``metadata.group_name``
acting as an intersection (AND) filter. The set of returned ``file_name``
values is printed as a JSON array on the final line of stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Iterable

from alchemyst_ai import AlchemystAI


def log(msg: str) -> None:
    """Diagnostic logging that goes to stderr so as not to pollute stdout."""
    print(msg, file=sys.stderr, flush=True)


def build_documents(run_id: str) -> list[dict[str, Any]]:
    """Build the three demo documents with run-id namespaced file names."""
    return [
        {
            "content": (
                "Document A discusses the engineering roadmap for product v1. "
                "FILE_MARKER=docA"
            ),
            "metadata": {
                "file_name": f"docA-{run_id}.md",
                "group_name": ["eng", "v1"],
            },
        },
        {
            "content": (
                "Document B discusses the engineering plan for product v2. "
                "FILE_MARKER=docB"
            ),
            "metadata": {
                "file_name": f"docB-{run_id}.md",
                "group_name": ["eng", "v2"],
            },
        },
        {
            "content": (
                "Document C contains the documentation set for product v1. "
                "FILE_MARKER=docC"
            ),
            "metadata": {
                "file_name": f"docC-{run_id}.md",
                "group_name": ["docs", "v1"],
            },
        },
    ]


def safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """Helper to read attributes from either dict-like or object-like records."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def ingest(client: AlchemystAI, documents: list[dict[str, Any]]) -> None:
    """Ingest the documents, gracefully handling re-runs (409 / duplicates).

    To make the CLI safely rerunnable with the same ZEALT_RUN_ID, we attempt to
    delete any pre-existing document with the same file_name before adding it.
    Any failure during the delete pass is logged but never fatal.
    """
    for doc in documents:
        file_name = doc["metadata"]["file_name"]
        try:
            client.v1.context.delete(
                source="docs",
                metadata={"file_name": file_name},
            )
            log(f"Pre-deleted any prior copy of {file_name} (if existed).")
        except Exception as exc:  # noqa: BLE001 - best effort cleanup
            log(f"Pre-delete for {file_name} ignored: {exc!r}")

    try:
        result = client.v1.context.add(
            documents=documents,
            context_type="resource",
            source="docs",
            scope="internal",
        )
        log(f"Ingest response: {result!r}")
    except Exception as exc:  # noqa: BLE001
        # If the backend still complains about duplicates (409) we just log it
        # since the goal is idempotency for rerunnability.
        msg = str(exc).lower()
        if "409" in msg or "conflict" in msg or "already exists" in msg:
            log(f"Ingest reported a conflict (treated as idempotent): {exc!r}")
        else:
            raise


def extract_file_name(contexts_item: Any, expected_file_names: set[str]) -> str | None:
    """Best-effort extraction of the source file_name from a search result chunk."""
    metadata = safe_get(contexts_item, "metadata")
    if metadata is not None:
        file_name = safe_get(metadata, "file_name")
        if isinstance(file_name, str) and file_name:
            return file_name

    # Fall back to scanning the chunk content for an expected file name marker.
    content = safe_get(contexts_item, "content")
    if isinstance(content, str):
        for fn in expected_file_names:
            if fn in content:
                return fn
        # Use FILE_MARKER=docX to deterministically recover the file name.
        for marker_short, full in (
            ("FILE_MARKER=docA", "docA"),
            ("FILE_MARKER=docB", "docB"),
            ("FILE_MARKER=docC", "docC"),
        ):
            if marker_short in content:
                for fn in expected_file_names:
                    if fn.startswith(full):
                        return fn
    return None


def search_with_retry(
    client: AlchemystAI,
    group_names: Iterable[str],
    expected_file_names: set[str],
    max_attempts: int = 6,
) -> list[Any]:
    """Search a few times with a short backoff to let indexing settle."""
    query = (
        "Document content about engineering or documentation for product "
        + " ".join(group_names)
    )
    last_contexts: list[Any] = []
    for attempt in range(1, max_attempts + 1):
        try:
            result = client.v1.context.search(
                query=query,
                similarity_threshold=0.1,
                scope="internal",
                metadata={"group_name": list(group_names)},
            )
        except Exception as exc:  # noqa: BLE001
            log(f"Search attempt {attempt} raised: {exc!r}")
            time.sleep(2.0)
            continue

        contexts = safe_get(result, "contexts") or []
        log(f"Search attempt {attempt}: received {len(contexts)} chunk(s).")
        last_contexts = list(contexts)
        if contexts:
            return last_contexts
        time.sleep(2.0)
    return last_contexts


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Context Arithmetic intersection demo (Alchemyst AI).",
    )
    parser.add_argument(
        "--groups",
        nargs="+",
        required=True,
        help="One or more group_name values; documents must belong to ALL of them.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        log("Missing ALCHEMYST_AI_API_KEY environment variable.")
        return 2

    run_id = os.environ.get("ZEALT_RUN_ID", "local")
    log(f"Using ZEALT_RUN_ID={run_id!r}")

    client = AlchemystAI(api_key=api_key)

    documents = build_documents(run_id)
    expected_file_names = {doc["metadata"]["file_name"] for doc in documents}

    ingest(client, documents)

    contexts = search_with_retry(
        client,
        group_names=args.groups,
        expected_file_names=expected_file_names,
    )

    # Deduplicate by file_name while preserving first-seen order.
    seen: set[str] = set()
    output: list[dict[str, Any]] = []
    for item in contexts:
        fn = extract_file_name(item, expected_file_names)
        if not fn:
            continue
        if fn in seen:
            continue
        seen.add(fn)
        output.append({"file_name": fn})

    # Final stdout line: a JSON array of {file_name: ...} objects.
    sys.stdout.write(json.dumps(output) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
