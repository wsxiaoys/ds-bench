# Create and Deploy a Hello World API with Encore.ts

## Background
Encore is a backend framework for building type-safe distributed systems. It automatically provisions infrastructure and provides an integrated cloud platform. In this task, you will create a simple Hello World API using Encore.ts and deploy it to Encore Cloud.

## Requirements
- Create an Encore.ts application.
- The application name should be `hello-${run-id}` where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable.
- Implement a single REST API endpoint `GET /hello/:name` that returns `{ "message": "Hello <name>!" }`.
- Deploy the application to Encore Cloud.
- Write the deployed app's base URL to a log file after a successful deployment.

## Implementation Hints
- Docker is NOT available in this environment. You CANNOT use `encore run` to test locally. You must deploy the app to Encore Cloud for testing.
- Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` value to `~/.config/encore/.auth_token`, then verify with `encore auth whoami`.
- Initialize the app using `encore app init hello-${run-id} --lang ts` and ensure the code is located in `/home/user/myproject`.
- The app ID can be extracted from the `encore.app` file (e.g., using a regex like `"id"\s*:\s*"([^"]+)"`).
- To deploy: initialize a git repository in the app directory, commit your code, add the Encore git remote (`git remote add encore encore://<app-id>`), and push (`git push encore`).
- The deployment may take about 2 minutes.
- Once deployed, the endpoint will be accessible at `https://staging-<app-id>.encr.app/`.
- Write the base URL to `/home/user/myproject/output.log`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the real deployment action is executed and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The log file must contain the base URL in the format: `Base URL: https://staging-<app-id>.encr.app`.
- API Endpoints:
  - GET `/hello/:name`: Returns status 200 and a JSON object with a `message` field.

    ```json
    // Response
    {
      "message": "Hello <name>!"
    }
    ```

