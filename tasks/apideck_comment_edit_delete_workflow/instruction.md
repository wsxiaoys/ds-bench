# Apideck Issue Tracking: Comment Edit & Delete Workflow

## Background
You are working with the Apideck Unified Issue Tracking API connected to GitHub (service id `github`). Your job is to drive a full comment-modification workflow on a single ticket: create the ticket, append a sequence of comments, edit one of them in place, and remove another. The final state on the remote ticket must match the expected configuration.

The project is located at `/home/user/apideck_task`.

## Requirements
- Create exactly one ticket inside the collection identified by the `APIDECK_ISSUE_TRACKING_COLLECTION_ID` environment variable. The ticket's subject must contain both the marker `[COMMENT-EDIT-DELETE]` and the current run ID read from `/logs/artifacts/run-id`.
- Add four comments to this ticket in sequence with the following bodies (where `<run-id>` is the value from `/logs/artifacts/run-id`):
  - `A-<run-id>`
  - `B-<run-id>`
  - `C-<run-id>`
  - `D-<run-id>`
- Edit the comment with body `B-<run-id>` in place to change its body to `B-EDITED-<run-id>`.
- Delete the comment with body `C-<run-id>`.
- After the workflow finishes, ensure that exactly three comments remain on that ticket with the expected bodies: `A-<run-id>`, `B-EDITED-<run-id>`, and `D-<run-id>`.
- Persist a log file at `/home/user/apideck_task/output.log`. The log file must contain a line of the form `Ticket ID: <ticket_id>` for the ticket created by this run.

## Implementation Hints
- Read all credentials, ids, and `/logs/artifacts/run-id` from environment variables before issuing any request.
- Apideck Unified APIs require `Authorization`, `x-apideck-app-id`, `x-apideck-consumer-id`, and `x-apideck-service-id` on every call.
- Comments live under `/issue-tracking/collections/{collection_id}/tickets/{ticket_id}/comments`; the body field on create/update is `body`.
- Use the official endpoints to create, update (PATCH), and delete comments — do not work around them with `pass_through` rewrites.
- The List Comments endpoint paginates with an opaque cursor (`meta.cursors.next`); you may need to follow it to verify final state.

