# Integrate trpc-panel with tRPC v11

## Background
`trpc-panel` is a popular tool for automatically generating a testing UI for tRPC routers, similar to Swagger UI. Although originally designed for tRPC v10, it can be integrated with tRPC v11. Your task is to set up a basic Express server with a tRPC v11 router and integrate `trpc-panel` to serve a documentation UI.

## Requirements
- Create an Express server running on port 3000.
- Set up a tRPC v11 router with at least one public procedure (e.g., a `hello` query that takes a `name` string input via `zod` and returns a greeting).
- Serve the tRPC API at `/trpc`.
- Integrate `trpc-panel` and serve it at the `/panel` endpoint.

## Implementation Guide
1. Initialize a Node.js project in `/home/user/project`.
2. Install `express`, `zod`, `@trpc/server@next`, and `trpc-panel`.
3. Create `index.js` setting up the Express app.
4. Initialize a tRPC v11 router and define a `greeting` query that accepts a `name` string.
5. Use `@trpc/server/adapters/express` to mount the tRPC router at `/trpc`.
6. Use `renderTrpcPanel` from `trpc-panel` to serve the UI at `/panel`, pointing it to the `/trpc` URL.

## Constraints
- Project path: `/home/user/project`
- Start command: `node index.js`
- Port: 3000