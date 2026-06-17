# Multi-Service API with Encore in Go

## Background
Create a multi-service application in Go using the Encore framework. The application should consist of two services that communicate with each other, demonstrating Encore's service-to-service API call capabilities.

## Requirements
- Create an Encore application in Go.
- Implement a `user` service with an endpoint `GET /user/:id` that returns a user object.
- Implement an `order` service with an endpoint `GET /order/:id` that returns an order object.
- The `order` service must make a service-to-service call to the `user` service to fetch the user details and include them in its response.
- Deploy the application to Encore Cloud.

## Implementation Hints
- Use `encore app init` to create the application.
- Define the `user` service with an exported API function.
- Define the `order` service that imports the `user` service package and calls its API function directly as a normal Go function call (Encore handles the networking).
- You must deploy the app to Encore Cloud since local execution via Docker is not available in this environment.
- **Authentication**: Write the provided `ENCORE_AUTH_TOKEN_JSON` environment variable to `~/.config/encore/.auth_token` to authenticate with Encore.
- **Deployment Guide**:
  1. `git init`
  2. `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
  3. `encore app init myapp --lang go` (or similar)
  4. Get the app ID from `encore.app`.
  5. `git remote add encore encore://<app-id>`
  6. `git add . && git commit -m "deploy" && git push encore`
  7. Wait for deployment to finish.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the app is deployed to Encore Cloud.
- The application must have a `user` service and an `order` service.
- API Endpoints (deployed to `https://staging-<app-id>.encr.app`):
  - GET `/user/:id`: Returns status 200 and a JSON object with `id` (string) and `name` (string).
  - GET `/order/:id`: Returns status 200 and a JSON object with `id` (string), `user_id` (string), and `user_name` (string). It must fetch the user details from the `user` service.

