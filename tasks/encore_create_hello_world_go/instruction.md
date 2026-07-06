# Create a Hello World API in Go with Encore

## Background
Encore is an open-source backend framework for building type-safe distributed systems. Create a simple Hello World API using Encore's Go SDK and deploy it to Encore Cloud.

## Requirements
- Initialize a new Encore app in Go under the `/home/user` directory (i.e., `/home/user/helloworld-${run-id}`).
- The app name must be `helloworld-${run-id}`.
- Create a service named `hello` with an API endpoint `World` that responds to `GET /hello/:name`.
- The endpoint should return a JSON response containing a greeting message, e.g., `Hello, <name>!`.
- Deploy the application to Encore Cloud.

## Implementation Hints
- Read the current `run-id` from `/logs/artifacts/run-id`.
- Authenticate with Encore using the provided token: `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`.
- Initialize the app under `/home/user` using `encore app init helloworld-${run-id} --lang go`.
- Define the API endpoint using the `//encore:api` annotation above a standard Go function.
- Since Docker is NOT available in this environment, you cannot use `encore run` to test locally. You must deploy the app to Encore Cloud for testing.
- To deploy to Encore Cloud:
  1. Initialize a git repository: `git init`
  2. Find the app ID in the `encore.app` file.
  3. Add the Encore git remote: `git remote add encore encore://<app-id>`
  4. Commit your code and push to the Encore remote: `git push encore`
  5. Wait for the deployment to finish.

