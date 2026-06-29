# Apideck Issue Tracking: Ticket Subject & Description Update Workflow

## Background
You are working with the Apideck Unified Issue Tracking API connected to GitHub (service id `github`). Your job is to drive a small ticket-revision workflow: create a single ticket inside the configured collection with an initial subject and description, then update both fields via the unified PATCH endpoint, and finally persist the resulting ticket identifier for auditing.

## Requirements
- Create your project at `/home/user/apideck_task`.
- Create exactly one ticket inside the collection identified by the `APIDECK_ISSUE_TRACKING_COLLECTION_ID` environment variable.
- The initial subject must contain the literal marker `[UPDATE-V1]` together with the current `/logs/artifacts/run-id` value.
- After creation, update the ticket through the official unified Update Ticket endpoint so that the subject contains the literal marker `[UPDATE-V2]` together with the current `/logs/artifacts/run-id` value, and the description contains the literal string `Revised draft v2`.
- Record the resulting ticket identifier to the log file `/home/user/apideck_task/output.log` so the workflow is auditable. The log file must contain a line of the form `Ticket ID: <ticket_id>` (where `<ticket_id>` is the actual ID of the created ticket).

## Implementation Hints
- Read all credentials, the collection id, and `/logs/artifacts/run-id` from environment variables before issuing any request.
- Apideck Unified APIs require `Authorization: Bearer <APIDECK_API_KEY>`, `x-apideck-app-id`, `x-apideck-consumer-id`, and `x-apideck-service-id: github` on every call.
- Use `POST /issue-tracking/collections/{collection_id}/tickets` to create the ticket and `PATCH /issue-tracking/collections/{collection_id}/tickets/{ticket_id}` to update it. Do not work around these endpoints with `pass_through` rewrites.
- The PATCH endpoint accepts `subject` and `description` in the request body; you must also include the ticket `id` in the body as required by the Apideck schema.
- Note that GitHub does not honor every unified field (for example `priority`). Stick to `subject` and `description` for this workflow.
- The List Tickets endpoint is cursor-paginated through `meta.cursors.next`; you may need to follow the cursor to verify the final state.

