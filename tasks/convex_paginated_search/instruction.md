# Convex Paginated Full-Text Search

## Background
Convex provides built-in full-text search capabilities through search indexes. Search queries automatically rank results by relevance, support filtering on additional fields, and work seamlessly with pagination.
In this task, you will implement a paginated full-text search query for a `messages` table.

## Requirements
- Initialize a Node.js project and install `convex`.
- Define a table `messages` with fields `body` (string), `author` (string), and `channelId` (string).
- Define a search index on the `messages` table named `search_body` that searches the `body` field and filters on `channelId`.
- Implement a mutation `api.messages.insert` to insert a message.
- Implement a query `api.messages.search` that takes `query` (string), `channelId` (string), and `paginationOpts` (from `paginationOptsValidator`) and returns the paginated search results using the `search_body` index.
- Create a Node.js script `test.js` that uses `ConvexHttpClient` to interact with your Convex backend. The script must take `--run-id <run-id>` as an argument.
- The script `test.js` should:
  1. Read the `CONVEX_URL` environment variable to initialize the client.
  2. Insert 3 messages with the provided `run-id` as the `channelId`:
     - `body`: "Hello world", `author`: "Alice"
     - `body`: "Hello Convex", `author`: "Bob"
     - `body`: "Hello search", `author`: "Charlie"
  3. Wait for the search index to update (search indexing is asynchronous, so you should poll/retry the search query until results are found).
  4. Perform a paginated search query for the keyword "Hello" in the `run-id` channel, fetching exactly 2 items per page.
  5. Print the `page` array from the pagination result to stdout as a JSON array.

## Implementation Hints
- Define the schema in `convex/schema.ts` using `defineSchema` and `defineTable`, and add the search index using `.searchIndex("search_body", { searchField: "body", filterFields: ["channelId"] })`.
- Expose the `insert` mutation and `search` query in `convex/messages.ts`.
- Use the `paginationOptsValidator` from `"convex/server"` for the pagination arguments in the search query.
- Use `ctx.db.query("messages").withSearchIndex("search_body", q => q.search("body", args.query).eq("channelId", args.channelId)).paginate(args.paginationOpts)` to execute the paginated search.
- Use `ConvexHttpClient` from `"convex/browser"` in `test.js`.
- Add a retry loop in `test.js` when searching, as it may take a few seconds for newly inserted documents to be indexed and returned by the search query.

## Acceptance Criteria
- Project path: /home/user/convex-search
- Command: `node test.js --run-id <run-id>`
- The command input argument format: `--run-id <run-id>`
- The expected command output format: The stdout should print a JSON array containing 2 message objects representing the first page of search results.

