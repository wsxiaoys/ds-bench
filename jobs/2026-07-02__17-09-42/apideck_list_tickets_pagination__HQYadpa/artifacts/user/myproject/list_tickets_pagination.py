#!/usr/bin/env python3
"""Seed 5 tickets in an Apideck issue-tracking collection, then walk the
collection using cursor pagination with limit=2 and write a JSON artifact
of the tickets that belong to the current run.

Uses the official ``apideck-unify`` Python SDK for every Apideck call.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from apideck_unify import Apideck
from apideck_unify.models.issuetracking_collectionticketsaddop import (
    IssueTrackingCollectionTicketsAddResponse,
)
from apideck_unify.models.issuetracking_collectionticketsallop import (
    IssueTrackingCollectionTicketsAllResponse,
)


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def main() -> None:
    run_id = _env("RUN_ID_PATH")
    # The task stores the run-id in a file at /logs/artifacts/run-id.
    run_id_value = Path(run_id).read_text().strip()

    app_id = _env("APIDECK_APP_ID")
    api_key = _env("APIDECK_API_KEY")
    consumer_id = _env("APIDECK_CONSUMER_ID")
    collection_id = _env("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    apideck = Apideck(api_key=api_key, app_id=app_id, consumer_id=consumer_id)

    # ------------------------------------------------------------------
    # 1) Seed exactly 5 new tickets using the unified surface.
    # ------------------------------------------------------------------
    description = f"Seeded by list_tickets_pagination_py for run {run_id_value}"

    seeded: list[dict[str, str | int]] = []
    for n in range(1, 6):
        subject = f"Pagination demo {n} - {run_id_value}"
        create_resp: IssueTrackingCollectionTicketsAddResponse = (
            apideck.issue_tracking.collection_tickets.create(
                collection_id=collection_id,
                service_id="github",
                subject=subject,
                description=description,
            )
        )
        # The create response wraps either GetTicketResponse or an
        # UnexpectedErrorResponse in a tagged union.
        created = getattr(create_resp, "create_ticket_response", None)
        if created is None or created.data is None:
            error = getattr(create_resp, "unexpected_error_response", None)
            raise SystemExit(
                f"Failed to seed ticket #{n}: subject={subject!r} error={error}"
            )
        ticket_id = created.data.id
        if not ticket_id:
            raise SystemExit(f"Created ticket #{n} has no id: {created}")
        seeded.append({"index": n, "id": ticket_id, "subject": subject})
        print(f"Seeded ticket #{n}: id={ticket_id} subject={subject!r}")

    # ------------------------------------------------------------------
    # 2) Walk the collection using cursor pagination with limit=2.
    # ------------------------------------------------------------------
    page_count = 0
    all_tickets: list[tuple[str, str]] = []  # (id, subject)

    res: IssueTrackingCollectionTicketsAllResponse | None = (
        apideck.issue_tracking.collection_tickets.list(
            collection_id=collection_id,
            service_id="github",
            limit=2,
        )
    )

    while res is not None:
        page_count += 1
        page_payload = getattr(res, "get_tickets_response", None)
        if page_payload is None:
            error = getattr(res, "unexpected_error_response", None)
            raise SystemExit(f"List response missing payload on page {page_count}: {error}")

        items = page_payload.data or []
        cursor_info = (
            page_payload.meta.cursors.next if page_payload.meta and page_payload.meta.cursors else None
        )
        print(
            f"Page {page_count}: {len(items)} ticket(s); next cursor={cursor_info!r}"
        )
        for t in items:
            all_tickets.append((t.id, t.subject or ""))

        # Move to the next page via the SDK's helper, which follows the
        # ``meta.cursors.next`` cursor under the hood.
        res = res.next()

    print(f"Pagination complete: walked {page_count} page(s), collected {len(all_tickets)} ticket(s) total.")

    # ------------------------------------------------------------------
    # 3) Filter to the tickets whose subject contains the current run-id
    #    and assemble the artifact.
    # ------------------------------------------------------------------
    run_subjects = {entry["subject"]: entry for entry in seeded}
    matching: list[dict[str, str | int]] = []
    for ticket_id, subject in all_tickets:
        entry = run_subjects.get(subject)
        if entry is None:
            continue
        matching.append(
            {
                "index": entry["index"],
                "id": ticket_id,
                "subject": entry["subject"],
            }
        )

    matching.sort(key=lambda e: int(e["index"]))

    artifact = {
        "run_id": run_id_value,
        "collection_id": collection_id,
        "page_count": page_count,
        "tickets": matching,
    }

    out_path = Path("/home/user/myproject/tickets.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2) + "\n")
    print(f"Wrote artifact to {out_path}: {artifact}")


if __name__ == "__main__":
    main()