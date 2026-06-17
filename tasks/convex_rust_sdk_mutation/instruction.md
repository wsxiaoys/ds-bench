# Convex Rust SDK Mutation

## Background
Convex provides a Rust SDK for interacting with its reactive database. In this task, you will create a Convex backend with a mutation and a Rust CLI application that calls this mutation.

## Requirements
- Create a Convex backend with a `tasks` table.
- Implement a mutation `api.tasks.create` in `convex/tasks.ts` that inserts a new document into the `tasks` table. The document should contain `text` (string) and `runId` (string).
- Create a Rust CLI application in the `rust-client` directory that connects to the Convex backend.
- The Rust CLI should take a single command-line argument for the `text` field.
- The Rust CLI should read the `ZEALT_RUN_ID` environment variable and use it for the `runId` field.
- The Rust CLI must call the `tasks:create` mutation with the provided `text` and `runId`, and then exit.
- Note: Building Rust might take >120s. You should start a background job to build the Rust project (`cargo build`) early to save time.

## Implementation Hints
- Run `npm init -y` and `npm install convex` to set up the Convex project.
- Write your Convex backend functions in the `convex/` directory.
- Use `npx convex deploy` to deploy your backend to the cloud. You have `CONVEX_DEPLOY_KEY` and `CONVEX_URL` available in the environment.
- Create the Rust project using `cargo new rust-client`.
- Add `convex`, `tokio`, and `dotenvy` as dependencies in your Rust project.
- Use `ConvexClient` from the `convex` crate to connect to `CONVEX_URL`.
- Call `client.mutation("tasks:create", map).await` in your Rust code. You can use `std::collections::BTreeMap` for the arguments.
- Pass the command-line argument and `ZEALT_RUN_ID` to the mutation arguments.

## Acceptance Criteria
- Project path: /home/user/myproject
- The Convex backend must be deployed and accessible.
- Command: `cargo run --manifest-path rust-client/Cargo.toml -- <text>`
- The Rust CLI must successfully call the mutation and insert a document into the Convex database.
- The inserted document must have the `text` provided as the argument and the `runId` from `ZEALT_RUN_ID`.

