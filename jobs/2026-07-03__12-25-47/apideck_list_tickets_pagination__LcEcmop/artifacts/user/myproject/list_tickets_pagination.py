#!/usr/bin/env python3
"""Cursor-paginated listing of Apideck issue tracking tickets."""
import json
import os
import sys
import time

from apideck_unify import Apideck


def main() -> int:
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
    run_id = open("/logs/artifacts/run-id").read().strip()

    for n, v in (
        ("APIDECK_API_KEY", api_key),
        ("APIDECK_APP_ID", app_id),
        ("APIDECK_CONSUMER_ID", consumer_id),
        ("APIDECK_ISSUE_TRACKING_COLLECTION_ID", collection_id),
    ):
        if not v:
            print(f"Missing env var {n}", file=sys.stderr)
            return 1
    if not run_id:
        print("Missing run id", file=sys.stderr)
        return 1

    client = Apideck(api_key=api_key, app_id=app_id, consumer_id=consumer_id)
    issue_tracking = client.issue_tracking
    tickets_api = issue_tracking.collection_tickets
    service_id = "github"

    # --- Seed exactly 5 tickets ---
    seeded_subjects = []
    for idx in range(1, 6):
        subject = f"Pagination demo {idx} - {run_id}"
        description = f"Seeded by list_tickets_pagination_py for run {run_id}"
        res = tickets_api.create(
            collection_id=collection_id,
            service_id=service_id,
            subject=subject,
            description=description,
        )
        if res is None:
            print(f"create returned None for index {idx}", file=sys.stderr)
            return 1
        created_resp = getattr(res, "create_ticket_response", None)
        data = getattr(created_resp, "data", None) if created_resp else None
        new_id = getattr(data, "id", None) if data else None
        print(f"Seeded #{idx} subject={subject!r} id={new_id}")
        seeded_subjects.append((idx, subject, new_id))
        # Small delay to allow downstream propagation.
        time.sleep(0.5)

    # --- Walk the whole collection with cursor pagination, limit=2 ---
    all_tickets = []
    page_count = 0
    next_call = None
    response = tickets_api.list(
        collection_id=collection_id,
        service_id=service_id,
        limit=2,
    )
    while response is not None:
        page_count += 1
        get_resp = getattr(response, "get_tickets_response", None)
        if get_resp is not None:
            all_tickets.extend(get_resp.data or [])
            cursors = getattr(get_resp.meta, "cursors", None) if get_resp.meta else None
            next_cursor = getattr(cursors, "next", None) if cursors else None
            print(f"Page {page_count}: {len(get_resp.data or [])} tickets, next cursor present={bool(next_cursor)}")
        next_call = getattr(response, "next", None)
        if next_call is None:
            break
        response = next_call()

    print(f"Pagination finished after {page_count} pages, total tickets in collection: {len(all_tickets)}")

    # --- Filter to run-scoped tickets ---
    run_scoped = [t for t in all_tickets if t.subject and run_id in t.subject]
    by_subject = {t.subject: t for t in run_scoped if t.subject}

    # --- Build output ---
    out_tickets = []
    for idx, subject, _ in seeded_subjects:
        match = by_subject.get(subject)
        ticket_id = match.id if match is not None else None
        out_tickets.append({"index": idx, "id": ticket_id, "subject": subject})

    payload = {
        "run_id": run_id,
        "collection_id": collection_id,
        "page_count": page_count,
        "tickets": out_tickets,
    }

    out_path = "/home/user/myproject/tickets.json"
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {out_path}")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
