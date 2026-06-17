# Convex File Upload Backend

## Background
Convex provides built-in file storage for large files like images, videos, and PDFs. In this task, you will implement the backend logic to support a multi-step file upload flow using Convex.

## Requirements
- Initialize a Convex project in `/home/user/project`.
- Define a schema in `convex/schema.ts` with a `files` table containing `storageId` (an ID for `_storage`), `title` (string), and `runId` (string).
- In `convex/files.ts`, expose a mutation `generateUploadUrl` that generates and returns an upload URL using `ctx.storage.generateUploadUrl()`.
- In `convex/files.ts`, expose a mutation `saveFile` that accepts `storageId`, `title`, and `runId`, and inserts a record into the `files` table.
- In `convex/files.ts`, expose a query `listFiles` that accepts a `runId` string and returns all files matching that `runId`. Each returned file object must include `title` and `url` (the download URL obtained via `ctx.storage.getUrl`).
- Deploy the Convex functions to the cloud using `npx convex deploy`.

## Implementation Hints
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable when running any client scripts, but for the backend, just accept `runId` as an argument.
- Use `v.id("_storage")` to validate the `storageId` argument.
- Use `ctx.storage.getUrl(storageId)` in your query to get the download URL for a file.
- Use `npx convex deploy` to deploy your backend. It will automatically use the `CONVEX_DEPLOY_KEY` provided in the environment.

## Acceptance Criteria
- Project path: /home/user/project
- Ensure the real deployment action is executed.
- Use `npx convex deploy` to deploy the functions.
- The backend must expose `api.files.generateUploadUrl` (mutation, no args, returns string).
- The backend must expose `api.files.saveFile` (mutation, args: `storageId`, `title`, `runId`).
- The backend must expose `api.files.listFiles` (query, args: `runId`, returns array of objects with `title` and `url`).

