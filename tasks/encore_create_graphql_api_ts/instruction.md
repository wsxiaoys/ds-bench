# Create a GraphQL API with Encore.ts

## Background
Encore is a backend framework for building type-safe distributed systems. In this task, you will create a simple GraphQL API using Encore.ts and deploy it to Encore Cloud.

## Requirements
- Initialize a new Encore TypeScript application named `graphql-api`.
- Create a service that exposes a GraphQL endpoint at `/graphql`.
- The GraphQL schema must define a Query `hello(name: String): String!`.
- The `hello` query should return `Hello, <name>!` if a name is provided, or `Hello, World!` if no name is provided.
- The GraphQL endpoint must accept POST requests with standard GraphQL JSON payloads.
- Deploy the application to Encore Cloud.

## Implementation Hints
- Use `encore app init graphql-api --lang ts` to create the application (remove the `encore.app` file if it already exists before running this command).
- You can use any GraphQL library (e.g., `graphql`, `@apollo/server`, `graphql-yoga`) to handle the schema and execution.
- In Encore.ts, use a **raw endpoint** (e.g., `api.raw(...)`) to handle the incoming HTTP request and pass it to your GraphQL execution logic.
- The task executor is expected to deploy the app to Encore Cloud. Docker is NOT available in the task execution environment.
- To deploy to Encore Cloud:
  1. Initialize a Git repository with `git init`.
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token`: `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`.
  3. Run `encore auth whoami` to confirm authentication.
  4. Read the app ID from the `encore.app` file (e.g., `graphql-api-xxxx`).
  5. Add the Encore Git remote: `git remote add encore encore://<app-id>`.
  6. Commit your code and push to the Encore remote: `git push encore`.
  7. Wait for the deployment to finish.

## Acceptance Criteria
- Project path: /home/user/graphql-api
- Ensure the application is successfully deployed to Encore Cloud.
- The verifier will test against the deployed endpoint at `https://staging-<app-id>.encr.app/graphql`.
- The endpoint must accept POST requests with a JSON body containing a GraphQL query.
- Request: `{"query": "query { hello }"}` -> Response JSON must contain `{"data": {"hello": "Hello, World!"}}`.
- Request: `{"query": "query { hello(name: \"Encore\") }"}` -> Response JSON must contain `{"data": {"hello": "Hello, Encore!"}}`.

