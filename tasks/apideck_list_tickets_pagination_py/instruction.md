# Cursor Paginate Apideck Issue Tracking Tickets with the Python SDK

## Background
[Apideck](https://www.apideck.com/) exposes a unified **Issue Tracking API** that normalizes ticket models from providers such as GitHub, Jira, Linear, and Asana. The unified `List Tickets` endpoint (`GET /issue-tracking/collections/{collection_id}/tickets`) is **cursor-paginated**: each response contains `meta.cursors.next` which must be followed (rather than computing offsets) until exhausted. In this task you will use the official [`apideck-unify` Python SDK](https://developers.apideck.com/sdks/python.md) to seed several tickets in the preconfigured GitHub-backed collection and then walk the entire collection with a small page size to collect every ticket created by the current run. This exercises both ticket creation through the unified surface and the opaque cursor pagination friction point documented in the research plan.

## Requirements
- Use the official `apideck-unify` Python SDK (do **not** call the REST endpoints with `requests`/`curl`, and do **not** use the Node SDK) for every Apideck call you make.
- Issue Tracking service id is `github`; the GitHub repository ("collection") to operate on is the one whose id is provided in `APIDECK_ISSUE_TRACKING_COLLECTION_ID`.
- Seed exactly **5** new tickets in that collection. Every seeded ticket must satisfy:
  - `subject` equals `Pagination demo {N} - {`/logs/artifacts/run-id`}` where `{N}` is an integer index starting at `1` and incrementing by `1` (so the subjects are `Pagination demo 1 - <run-id>` ... `Pagination demo 5 - <run-id>`).
  - `description` equals `Seeded by list_tickets_pagination_py for run <run-id>` (literal string, no extra whitespace).
- After seeding, **list** the collection's tickets and walk it page-by-page using cursor pagination with `limit=2`. You must rely on the cursor returned in `meta.cursors.next` (or the SDK's built-in pagination helper that uses it) — do **not** hard-code an upper bound on the total number of pages and do **not** call `List Tickets` once with a large `limit` to short-circuit pagination.
- From the aggregated pagination results, filter to the tickets whose `subject` contains the current `/logs/artifacts/run-id` value, then write a JSON artifact to `/home/user/myproject/tickets.json` with the following exact shape:
  ```json
  {
    "run_id": "<run-id>",
    "collection_id": "<APIDECK_ISSUE_TRACKING_COLLECTION_ID>",
    "page_count": <integer>,
    "tickets": [
      { "index": 1, "id": "<ticket id>", "subject": "Pagination demo 1 - <run-id>" },
      { "index": 2, "id": "<ticket id>", "subject": "Pagination demo 2 - <run-id>" },
      { "index": 3, "id": "<ticket id>", "subject": "Pagination demo 3 - <run-id>" },
      { "index": 4, "id": "<ticket id>", "subject": "Pagination demo 4 - <run-id>" },
      { "index": 5, "id": "<ticket id>", "subject": "Pagination demo 5 - <run-id>" }
    ]
  }
  ```
  - `page_count` is the number of pages traversed during the pagination walk (i.e., the number of `List Tickets` HTTP responses you consumed, including any pages that contained no run-scoped tickets).
  - `tickets` is an array of exactly 5 entries sorted by `index` ascending. Each entry's `id` must be the Apideck unified ticket `id` returned by the seeding/listing API, and each `subject` must match the corresponding seeded subject exactly.

## Implementation Hints
- Install the SDK via `pip install apideck-unify` and instantiate `Apideck(api_key=..., app_id=..., consumer_id=...)`. Most issue-tracking methods take `service_id="github"` and `collection_id=APIDECK_ISSUE_TRACKING_COLLECTION_ID`.
- Read `APIDECK_APP_ID`, `APIDECK_API_KEY`, `APIDECK_CONSUMER_ID`, `APIDECK_ISSUE_TRACKING_COLLECTION_ID`, and `/logs/artifacts/run-id` from the environment. Do not hard-code their values.
- Some optional ticket fields (e.g., `priority`) are not supported by the GitHub connector. Stick to `subject` and `description` when seeding.
- For pagination, prefer following `meta.cursors.next` (the SDK exposes `.next()` on list responses that uses that cursor under the hood). Each call must pass `limit=2`.
- Suggested references: [Issue Tracking API reference](https://developers.apideck.com/apis/issue-tracking/reference), [List Tickets](https://developers.apideck.com/md/apis/issue-tracking/reference/tickets/collectionTicketsAll.md), [Create Ticket](https://developers.apideck.com/md/apis/issue-tracking/reference/tickets/collectionTicketsAdd.md), [Python SDK guide](https://developers.apideck.com/sdks/python.md), [Unified Rate Limits / pagination notes](https://developers.apideck.com/guides/unified-rate-limits.md).

