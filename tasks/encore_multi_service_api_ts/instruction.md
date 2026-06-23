# Multi-Service API with Encore.ts

## Background
Encore makes it easy to build distributed systems by automatically handling service-to-service communication. In this task, you will create a multi-service Encore application in TypeScript and deploy it to Encore Cloud.

## Requirements
- Create an Encore application named `myapp`.
- Create a `user` service with an API endpoint `GET /user/:id` that returns a user object `{"id": number, "name": string}`. For simplicity, if the ID is 1, return the name "Alice", otherwise return "Unknown".
- Create an `order` service with an API endpoint `GET /order/:id` that returns an order object `{"orderId": number, "userId": number, "userName": string}`.
- The `order` service must call the `user` service internally to fetch the `userName`. For simplicity, hardcode the `order` endpoint to always fetch the user with ID 1.
- Deploy the application to Encore Cloud.
- Write the app ID to a log file.

## Implementation Hints
- Initialize the Encore app using `encore app init myapp --lang ts`.
- Define the two services by creating `user/encore.service.ts` and `order/encore.service.ts`.
- In Encore, service-to-service calls are strongly typed and done using the generated service clients. Import the user service client in the order service (e.g., `import { user } from "~encore/clients"`).
- **IMPORTANT**: Docker is NOT available in the task execution environment. Commands like `encore run` will fail. You MUST deploy the app to Encore Cloud to test it.
- To authenticate with Encore Cloud, write the provided `ENCORE_AUTH_TOKEN_JSON` environment variable to `~/.config/encore/.auth_token`:
  `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
- To deploy the app to Encore Cloud:
  1. `git init`
  2. `git remote add encore encore://<app-id>`
  3. `git add -A .`
  4. `git commit -m "Deploy"`
  5. `git push encore`
- You can find the app ID in the `encore.app` file after initialization.

## Acceptance Criteria
- Project path: /home/user/myapp
- Ensure the app is deployed to Encore Cloud.
- Log file: /home/user/myapp/deploy.log
- The log file must contain the app ID in the format: `App ID: <app-id>`.
- The deployed API must have the following endpoints accessible at `https://staging-<app-id>.encr.app`:
  - `GET /user/1`: Returns status 200 and JSON `{"id": 1, "name": "Alice"}`.
  - `GET /order/100`: Returns status 200 and JSON `{"orderId": 100, "userId": 1, "userName": "Alice"}`.

