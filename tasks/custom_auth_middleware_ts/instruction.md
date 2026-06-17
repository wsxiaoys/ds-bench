# Custom Authentication in Encore.ts

## Background
Encore is a backend framework for building type-safe distributed systems. In this task, you will create an Encore app and implement custom authentication middleware using Encore's `authHandler` pattern to protect an API endpoint.

## Requirements
- Create an Encore.ts app named `customauth`.
- Implement a custom authentication handler that checks the `Authorization` header for a Bearer token.
- If the token is `secret-token`, the auth handler should successfully authenticate and provide a user object with `userID: "user-123"`.
- If the token is missing or invalid, the auth handler should reject the request.
- Create a protected API endpoint `GET /dashboard` that requires authentication.
- The endpoint should return a welcome message including the authenticated user's ID.
- You MUST deploy the application to Encore Cloud for testing.

## Implementation Hints
- Use Encore's `authHandler` from `encore.dev/auth` to define the custom authentication logic.
- In your API definition for `/dashboard`, set `auth: true` to enforce authentication.
- Read the `ENCORE_AUTH_TOKEN_JSON` environment variable to authenticate the Encore CLI.
- **Deployment Guide**:
  1. Run `git init` in your project folder.
  2. Authenticate Encore: `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`.
  3. Initialize the app: `encore app init customauth --lang ts`.
  4. Find your App ID in the `encore.app` file.
  5. Add the Git remote: `git remote add encore encore://<app-id>`.
  6. Commit and push: `git add -A . && git commit -m 'Initial commit' && git push encore`.
  7. The deployment takes about 2 minutes. The deployed endpoint will be accessible at `https://staging-<app-id>.encr.app/`.

## Acceptance Criteria
- Project path: /home/user/customauth
- Ensure the app is deployed to Encore Cloud.
- The verifier will test against the deployed endpoint `https://staging-<app-id>.encr.app`.
- API Endpoints:
  - GET `/dashboard`:
    - When called without an `Authorization` header, returns a 401 Unauthorized status.
    - When called with `Authorization: Bearer wrong-token`, returns a 401 Unauthorized status.
    - When called with `Authorization: Bearer secret-token`, returns a 200 OK status and the following JSON response format:
      ```json
      {
        "message": "Welcome to the dashboard, user-123!"
      }
      ```

