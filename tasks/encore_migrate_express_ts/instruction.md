# Migrate Express.js to Encore.ts

## Background
Encore is an open-source backend framework for building type-safe distributed systems. You have an existing Express.js application at `/home/user/express-app`. You have been tasked with migrating it to Encore.ts and deploying the new application to Encore Cloud.

## Requirements
- Initialize a new Encore.ts application named `helloworld` at `/home/user/helloworld`.
- Implement a single API endpoint that replicates the behavior of the Express.js endpoint from `/home/user/express-app/index.js` (`GET /greet/:name` which returns `{"message": "Hello, <name>!"}`).
- Deploy the application to Encore Cloud.
- Write the deployed App ID to a log file.

## Implementation Hints
- Use `encore app init helloworld --lang ts` to initialize the app in the home directory.
- Define the API endpoint using `api` from `encore.dev/api` with `method: "GET"` and `path: "/greet/:name"`.
- To deploy to Encore Cloud, follow these steps in `/home/user/helloworld`:
  1. Run `git init`.
  2. Authenticate Encore by writing the provided `ENCORE_AUTH_TOKEN_JSON` environment variable to `~/.config/encore/.auth_token`:
     `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
  3. Run `encore auth whoami` to confirm authentication.
  4. Get the app ID (e.g., from the `encore.app` file).
  5. Add the Encore Git remote: `git remote add encore encore://<app-id>`.
  6. Commit your code and push to deploy: `git add . && git commit -m "deploy" && git push encore`.
- The deployment may take about 2 minutes to complete.
- Write the App ID to `/home/user/helloworld/app_id.log` in the format `App ID: <app_id>`.

## Acceptance Criteria
- Project path: /home/user/helloworld
- Ensure the app is deployed to Encore Cloud.
- Log file: /home/user/helloworld/app_id.log
- The log file must contain the App ID in the format: `App ID: <app_id>`.
- The deployed endpoint must be accessible at `https://staging-<app_id>.encr.app/greet/:name`.
- A GET request to the deployed endpoint must return a JSON response with the correct greeting message.

