#!/usr/bin/env python3
"""Seed 5 issue-tracking tickets in a GitHub-backed Apideck collection, then walk
the collection page-by-page using opaque cursor pagination (limit=2) and emit a
JSON artifact describing the run-scoped tickets that were created.

Uses the official `apideck-unify` Python SDK for every Apideck call.
"""

import json
import os
import re
import sys


def _read_run_id() -> str:
    run_id_path = "/logs/artifacts/run-id"
    with open(run_id_path, "r", encoding="utf-8") as fh:
        return fh.read().strip()


def main() -> int:
    app_id = os.environ.get("APIDECK_APP_ID")
    api_key = os.environ.get("APIDECK_API_KEY")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    missing = [
        name
        for name, val in (
            ("APIDECK_APP_ID", app_id),
            ("APIDECK_API_KEY", api_key),
            ("APIDECK_CONSUMER_ID", consumer_id),
            ("APIDECK_ISSUE_TRACKING_COLLECTION_ID", collection_id),
        )
        if not val
    ]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return 2

    run_id = _read_run_id()
    if not run_id:
        print("run-id file at /logs/artifacts/run-id is empty", file=sys.stderr)
        return 2

    print(f"run_id={run_id}")
    print(f"collection_id={collection_id}")

    # Import the SDK lazily so configuration errors surface first.
    from apideck_unify import Apideck

    apideck = Apideck(api_key=api_key, app_id=app_id, consumer_id=consumer_id)
    tickets_sdk = apideck.issue_tracking.collection_tickets

    service_id = "github"
    num_tickets = 5

    # --- Seed exactly `num_tickets` new tickets -------------------------------
    created_ids = []
    for n in range(1, num_tickets + 1):
        subject = f"Pagination demo {n} - {run_id}"
        description = f"Seeded by list_tickets_pagination_py for run {run_id}"
        print(f"Creating ticket {n}: {subject}")
        create_resp = tickets_sdk.create(
            collection_id=collection_id,
            service_id=service_id,
            subject=subject,
            description=description,
        )
        created_id = create_resp.create_ticket_response.data.id
        created_ids.append(created_id)
        print(f"  -> created id={created_id}")

    # --- Walk the collection page-by-page using cursor pagination -------------
    # Each `list` call is one List Tickets HTTP response. We follow the opaque
    # cursor returned in meta.cursors.next via the SDK's built-in `.next()`
    # helper (which reads that cursor under the hood) until it returns None.
    page_count = 0
    aggregated = []

    response = tickets_sdk.list(
        collection_id=collection_id,
        service_id=service_id,
        limit=2,
    )
    while response is not None:
        page_count += 1
        get_tickets_response = response.get_tickets_response
        if get_tickets_response is not None and get_tickets_response.data:
            aggregated.extend(get_tickets_response.data)
        # The SDK's `.next()` returns the next page response or None when the
        # cursor is exhausted (no meta.cursors.next).
        nxt = response.next
        response = nxt() if nxt is not None else None

    print(f"Pagination walk complete: page_count={page_count}, total tickets seen={len(aggregated)}")

    # --- Filter to run-scoped tickets and build the artifact ------------------
    index_re = re.compile(rf"^Pagination demo (\d+) - {re.escape(run_id)}$")

    run_scoped = []
    for ticket in aggregated:
        subject = ticket.subject
        if subject is None:
            continue
        if run_id not in subject:
            continue
        m = index_re.match(subject)
        if not m:
            # Subject contains the run-id but does not match the exact pattern;
            # skip it to avoid polluting the artifact.
            continue
        run_scoped.append(
            {
                "index": int(m.group(1)),
                "id": ticket.id,
                "subject": subject,
            }
        )

    run_scoped.sort(key=lambda t: t["index"])

    if len(run_scoped) != num_tickets:
        print(
            f"WARNING: expected {num_tickets} run-scoped tickets but found "
            f"{len(run_scoped)}",
            file=sys.stderr,
        )

    artifact = {
        "run_id": run_id,
        "collection_id": collection_id,
        "page_count": page_count,
        "tickets": run_scoped,
    }

    out_path = "/home/user/myproject/tickets.json"
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(artifact, fh, indent=2)
        fh.write("\n")

    print(f"Wrote artifact to {out_path}")
    print(json.dumps(artifact, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())