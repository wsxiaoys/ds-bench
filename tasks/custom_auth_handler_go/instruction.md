# Custom Auth Handler in Encore Go

## Background
Encore provides a built-in authentication system using the `//encore:authhandler` annotation. In this task, you will create an Encore Go application that implements a custom authentication handler and a protected API endpoint, and then deploy it to Encore Cloud.

## Requirements
- Create an Encore Go app with two packages: `auth` and `dashboard`.
- In the `auth` package, implement an authentication handler that validates an incoming token.
- The auth handler should accept a token. If the token equals `secret-token`, it should return an `auth.UID` of `user-123` and custom auth data containing `Role: "admin"`.
- If the token is invalid or missing, the auth handler should return an error with the `Unauthenticated` error code.
- In the `dashboard` package, create a protected API endpoint `GET /dashboard`.
- The endpoint must require authentication.
- The endpoint should read the authenticated user's ID and custom data from the context, and return a response message.
- Deploy the application to Encore Cloud.
- Write the deployed app's App ID to a log file.

## Implementation Hints
- Docker is NOT available in this environment, so `encore run` will not work. You must deploy the app to Encore Cloud for testing.
- Use `encore app init <app-name>` to initialize the project.
- To authenticate with Encore Cloud, read the `ENCORE_AUTH_TOKEN_JSON` environment variable and write it to `~/.config/encore/.auth_token`. Then run `encore auth whoami`.
- To deploy to Encore Cloud:
  1. Run `git init`.
  2. Add the Encore Git remote: `git remote add encore encore://<app-id>`.
  3. Commit your code and run `git push encore`.
- The deployed endpoint will be available at `https://staging-<app-id>.encr.app/`.
- Write the app ID to `/home/user/myproject/output.log`.
- Define the auth handler in the `auth` package using the `//encore:authhandler` annotation. It should return `(auth.UID, *YourCustomData, error)`.
- For the protected endpoint in the `dashboard` package, use the `//encore:api auth` annotation.
- Inside the protected endpoint, use `auth.UserID()` and `auth.Data()` to access the authenticated user's ID and custom data.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the app is deployed to Encore Cloud and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The log file must contain the App ID in the format: `App ID: <app_id>`.
- The deployed API endpoint `GET https://staging-<app_id>.encr.app/dashboard` must require authentication.
  - If no token or invalid token is provided, returns HTTP 401 Unauthorized.
  - If the `Authorization` header is `Bearer secret-token`, it should return HTTP 200 OK.
  - The successful JSON response must be exactly:
    ```json
    {
      "message": "Hello user-123, you are an admin"
    }
    ```

