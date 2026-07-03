#!/usr/bin/env python3
"""Context Arithmetic (Intersection) CLI for the Alchemyst AI Python SDK.

Ingests three documents with overlapping group_name arrays and then
performs a filtered search using the groups supplied via --groups.
The matching documents are printed as a JSON array on the final line
of stdout.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from alchemyst_ai import AlchemystAI
except Exception as exc:  # pragma: no cover
    sys.stderr.write("Failed to import alchemyst_ai SDK: " + str(exc) + "\n")
    raise


RUN_ID_ENV = "ALCHEMYST_RUN_ID"
RUN_ID_FILE = Path("/logs/artifacts/run-id")
SOURCE = "docs"
SCOPE = "internal"
CONTEXT_TYPE = "resource"

DOCUMENTS: List[Dict[str, Any]] = [
    {
        "suffix": "docA",
        "groups": ["eng", "v1"],
        "content": (
            "Document A: engineering design notes for version 1 of the "
            "authentication subsystem. Covers JWT issuance, refresh token "
            "rotation and the public-key bootstrap process."
        ),
    },
    {
        "suffix": "docB",
        "groups": ["eng", "v2"],
        "content": (
            "Document B: engineering design notes for version 2 of the "
            "authentication subsystem. Replaces the v1 design with a "
            "short-lived access token plus rotating refresh tokens."
        ),
    },
    {
        "suffix": "docC",
        "groups": ["docs", "v1"],
        "content": (
            "Document C: public customer-facing documentation for version 1 "
            "of the API. Describes refund policy, shipping policy and how "
            "customers authenticate against the public API."
        ),
    },
]


def log(msg: str) -> None:
    sys.stderr.write("[alch-cli] " + msg + "\n")
    sys.stderr.flush()


def read_run_id() -> str:
    env_val = os.environ.get(RUN_ID_ENV)
    if env_val:
        return env_val.strip()
    if RUN_ID_FILE.exists():
        return RUN_ID_FILE.read_text().strip()
    return str(int(time.time()))


def build_documents(run_id: str) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    for entry in DOCUMENTS:
        file_name = entry["suffix"] + "-" + run_id + ".md"
        marker = "FILE_NAME_MARKER:" + file_name
        docs.append({
            "content": marker + "\n" + entry["content"],
            "metadata": {
                "file_name": file_name,
                "group_name": list(entry["groups"]),
                "file_type": "text/markdown",
                "last_modified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        })
    return docs


def safe_delete(client: AlchemystAI) -> None:
    candidates = [
        {"organization_id": "default", "source": SOURCE, "by_doc": True},
        {"organization_id": "default", "source": SOURCE},
    ]
    for params in candidates:
        try:
            client.v1.context.delete(**params)
            log("delete succeeded with params=" + json.dumps(params))
            return
        except Exception as exc:  # noqa: BLE001
            log("delete attempt failed (" + type(exc).__name__ + "): " + str(exc))
            continue


def ingest_documents(client: AlchemystAI, documents: List[Dict[str, Any]]) -> None:
    try:
        safe_delete(client)
    except Exception as exc:  # noqa: BLE001
        log("safe_delete raised (ignored): " + str(exc))

    def _do_add() -> None:
        client.v1.context.add(
            context_type=CONTEXT_TYPE,
            source=SOURCE,
            scope=SCOPE,
            documents=documents,
            metadata={"group_name": ["context-arithmetic-run"]},
        )

    try:
        _do_add()
        log("ingested " + str(len(documents)) + " documents")
        return
    except Exception as exc:  # noqa: BLE001
        log("add raised " + type(exc).__name__ + ": " + str(exc))
        try:
            safe_delete(client)
        except Exception as exc2:  # noqa: BLE001
            log("retry safe_delete raised (ignored): " + str(exc2))
        _do_add()
        log("ingested " + str(len(documents)) + " documents after retry")


def search_documents(client: AlchemystAI, groups: List[str]) -> List[Dict[str, Any]]:
    query = (
        "engineering design authentication documentation version "
        "context arithmetic"
    )
    params: Dict[str, Any] = {
        "query": query,
        "similarity_threshold": 0.1,
        "minimum_similarity_threshold": 0.0,
        "scope": SCOPE,
        "metadata": {"group_name": list(groups)},
    }

    response = None
    last_err: Optional[Exception] = None
    for attempt in range(5):
        try:
            response = client.v1.context.search(**params)
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            log("search attempt " + str(attempt) + " failed: " + str(exc))
            time.sleep(0.5 + attempt * 0.5)
    if response is None:  # pragma: no cover
        raise RuntimeError("search failed after retries: " + str(last_err))

    contexts = response.contexts or []
    log("search returned " + str(len(contexts)) + " raw context(s)")

    seen = set()
    results: List[Dict[str, Any]] = []
    for ctx in contexts:
        meta = getattr(ctx, "metadata", None)
        file_name = None
        if isinstance(meta, dict):
            file_name = meta.get("file_name")
        elif meta is not None:
            try:
                meta_dict = dict(meta)
                file_name = meta_dict.get("file_name")
            except Exception:  # noqa: BLE001
                meta_dict = {}
        if not file_name:
            content = getattr(ctx, "content", None) or ""
            marker = "FILE_NAME_MARKER:"
            if marker in content:
                file_name = content.split(marker, 1)[1].split("\n", 1)[0].strip()
        if not file_name or file_name in seen:
            continue
        seen.add(file_name)
        entry: Dict[str, Any] = {"file_name": file_name}
        if isinstance(meta, dict):
            entry["metadata"] = meta
        score = getattr(ctx, "score", None)
        if score is not None:
            entry["score"] = score
        results.append(entry)

    return results


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Demonstrate Alchemyst AI Context Arithmetic intersection: "
            "ingest documents and search the intersection of the given "
            "groups."
        )
    )
    parser.add_argument(
        "--groups",
        nargs="+",
        required=True,
        help="One or more group names to intersect (e.g. --groups eng v1).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    run_id = read_run_id()
    groups = list(args.groups)
    log("run-id=" + run_id + " groups=" + ",".join(groups))

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    if not api_key:
        sys.stderr.write("ALCHEMYST_AI_API_KEY environment variable not set\n")
        return 2

    client = AlchemystAI(api_key=api_key)

    documents = build_documents(run_id)
    ingest_documents(client, documents)

    matches = search_documents(client, groups)

    sys.stdout.write(json.dumps(matches, indent=2, default=str))
    sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
