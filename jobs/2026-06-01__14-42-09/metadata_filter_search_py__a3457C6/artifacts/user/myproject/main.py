#!/usr/bin/env python3
"""Alchemyst AI metadata filter search CLI.

Seeds the Alchemyst AI Context Engine with documents that belong to three
distinct groups (``support``, ``billing``, ``engineering``) and then performs
a context search restricted to a single group via metadata filtering.

The result printed to ``stdout`` is a JSON array of the ``file_name`` values
that were stored under the requested group.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

from alchemyst_ai import AlchemystAI, ConflictError


# Two-plus documents per group, with deterministic slugs so that file_name
# values are stable across re-runs (within the same ZEALT_RUN_ID).
GROUPS: dict[str, list[tuple[str, str]]] = {
    "support": [
        (
            "support_refund_thread",
            "Customer requested a refund for order #1024 after their package "
            "was delayed by more than two weeks. Agent confirmed eligibility "
            "and started the refund workflow.",
        ),
        (
            "support_login_thread",
            "Customer reports they cannot log into their account because the "
            "password reset email never arrives. Issue escalated to identity "
            "team for further investigation.",
        ),
    ],
    "billing": [
        (
            "billing_invoice_overdue",
            "Invoice INV-9000 is now 14 days overdue. A reminder email was "
            "sent and the account was placed on a soft dunning path while we "
            "await payment.",
        ),
        (
            "billing_scale_pricing",
            "Customer is asking about pricing tiers and available discounts "
            "for upgrading to the Scale plan, including annual prepay terms.",
        ),
    ],
    "engineering": [
        (
            "engineering_db_incident",
            "Database outage occurred at 14:30 UTC due to connection pool "
            "exhaustion. Mitigation: failed over to the read replica and "
            "tuned pool sizing. Postmortem in progress.",
        ),
        (
            "engineering_api_v2_rfc",
            "RFC: API v2 design proposal introducing cursor-based pagination "
            "and consistent error envelopes, deprecating offset/limit "
            "endpoints over the next two releases.",
        ),
    ],
}


def _sanitize(token: str) -> str:
    """Make a string safe to embed in a file_name."""
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", token).strip("-") or "run"


def _build_file_name(run_id: str, group: str, slug: str) -> str:
    safe_run_id = _sanitize(run_id)
    return f"{safe_run_id}__{group}__{slug}.txt"


def _seed_documents(client: AlchemystAI, run_id: str) -> None:
    """Seed all documents for every group.

    The CLI is idempotent: if the Alchemyst API rejects duplicate file_name
    values with a 409 Conflict, we silently treat that as success since the
    documents are already present.
    """
    for group, docs in GROUPS.items():
        documents: list[dict[str, Any]] = []
        for slug, content in docs:
            file_name = _build_file_name(run_id, group, slug)
            documents.append(
                {
                    # Embed the file_name and group inline so a chunk's content
                    # always carries enough information to identify it, even
                    # if the response omits per-chunk metadata.
                    "content": (
                        f"[file_name={file_name}] [group={group}]\n{content}"
                    ),
                    "metadata": {
                        "file_name": file_name,
                        "group_name": [group],
                    },
                }
            )

        try:
            client.v1.context.add(
                context_type="resource",
                documents=documents,
                scope="internal",
                source=f"alchemyst-group-demo-{_sanitize(run_id)}-{group}",
                metadata={
                    "file_name": _build_file_name(run_id, group, "batch"),
                    "file_size": 1024,
                    "file_type": "text/plain",
                    "group_name": [group],
                    "last_modified": "2025-01-01T00:00:00.000Z",
                },
            )
        except ConflictError:
            # Duplicate file_name on re-run; nothing to do, the document
            # already exists in the Context Engine.
            continue


def _search_group(client: AlchemystAI, group: str) -> list[str]:
    """Search the Context Engine for documents belonging to ``group`` only."""
    result = client.v1.context.search(
        minimum_similarity_threshold=0.0,
        query=(
            f"All documents that belong to the {group} team. "
            "Customer support, billing, or engineering knowledge."
        ),
        similarity_threshold=1.0,
        metadata="true",
        scope="internal",
        # The Python SDK at v0.10.0 does not expose the body-level metadata
        # filter as a typed kwarg in a way that maps to the JSON ``metadata``
        # field expected by the API, so inject it through ``extra_body``.
        # The body JSON sent to the server will include
        # ``"metadata": {"group_name": [<group>]}`` which scopes the search
        # to the requested group only.
        extra_body={"metadata": {"group_name": [group]}},
    )

    file_names: set[str] = set()
    contexts = getattr(result, "contexts", None) or []
    for ctx in contexts:
        md = getattr(ctx, "metadata", None)
        if isinstance(md, dict):
            fn = md.get("file_name") or md.get("fileName")
            if isinstance(fn, str) and fn:
                file_names.add(fn)

        # Fallback: parse the inline marker from the chunk content. This
        # keeps the CLI robust if the server omits per-chunk metadata.
        content = getattr(ctx, "content", None) or ""
        if isinstance(content, str):
            match = re.search(r"\[file_name=([^\]]+)\]", content)
            if match:
                file_names.add(match.group(1))

    return sorted(file_names)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Seed Alchemyst AI with team-scoped documents and retrieve only "
            "the file_name values for a single team via metadata filtering."
        )
    )
    parser.add_argument(
        "--group",
        required=True,
        choices=sorted(GROUPS.keys()),
        help="Team whose documents to return (support, billing, or engineering).",
    )
    args = parser.parse_args(argv)

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID", "local")

    client = AlchemystAI(api_key=api_key)

    _seed_documents(client, run_id)

    file_names = _search_group(client, args.group)

    # Restrict the printed names to those that we actually stored under the
    # requested group during this run, so the array is never polluted by
    # unrelated documents that may already exist in the workspace.
    expected = {
        _build_file_name(run_id, args.group, slug)
        for slug, _content in GROUPS[args.group]
    }
    filtered = [name for name in file_names if name in expected]

    print(json.dumps(filtered))
    return 0


if __name__ == "__main__":
    sys.exit(main())
