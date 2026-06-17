# Convex Cursor-based Pagination

## Background
Convex provides built-in support for cursor-based pagination, allowing you to load data in chunks efficiently. Create a Convex backend that stores a list of messages and exposes a paginated query to retrieve them.

## Requirements
- Initialize a Node.js project and set up Convex in `/home/user/project`.
- Define a `messages` table in the Convex schema with a `text` field (string) and a `runId` field (string) to isolate test runs.
- Create a mutation named `insert` in `convex/messages.ts` that accepts `text` and `runId`, and inserts a new message into the database.
- Create a query named `list` in `convex/messages.ts` that accepts `runId` (string) and Convex's standard pagination options. It should filter by `runId`, order the results by `_creationTime` descending, and return paginated messages using Convex's built-in `.paginate()` method.
- Deploy the Convex functions to the cloud.

## Implementation Hints
- Read the `run-id` from the `ZEALT_RUN_ID` environment variable in your deployment or testing scripts if needed, but the API should accept it as an argument.
- Use `npx convex deploy` to push your schema and functions to the Convex cloud. The environment will have `CONVEX_DEPLOY_KEY` set.
- Use `paginationOptsValidator` from `convex/server` to validate the pagination arguments in your query.
- Filter by `runId` using `.filter(q => q.eq(q.field("runId"), args.runId))` or an index, then use `.order("desc")` and `.paginate(args.paginationOpts)`.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: npx convex deploy
- API Endpoints (Convex Functions):
  - Mutation `messages:insert`: Accepts `{ text: string, runId: string }` and returns the new document ID.
  - Query `messages:list`: Accepts `{ runId: string, paginationOpts: { numItems: number, cursor: string | null } }`. Returns a paginated result object containing `page` (array of messages), `isDone` (boolean), and `continueCursor` (string).

