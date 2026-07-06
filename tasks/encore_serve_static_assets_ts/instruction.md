# Serve Static Assets with Encore.ts

## Background
Create an Encore.ts application that serves static assets (HTML, CSS) using the `api.static` function.

## Requirements
- Initialize an Encore.ts application in `/home/user/myproject`.
- Create a service that serves static files from a `public` directory at the root path (so that `/index.html` and `/style.css` are accessible at the root of your application).
- The `public` directory should contain an `index.html` with the text "Hello Static World" and a `style.css`.
- Deploy the application to Encore Cloud.

## Implementation Hints
- Use `api.static` from `encore.dev/api` to serve the `public` directory.
- Docker is NOT available in the task execution environment. You MUST deploy the app to Encore Cloud for testing.
- Use the `ENCORE_AUTH_TOKEN_JSON` environment variable to authenticate with Encore Cloud.
- Deployment Guide:
  1. `git init`
  2. `mkdir -p ~/.config/encore && printf '%s' "$ENCORE_AUTH_TOKEN_JSON" > ~/.config/encore/.auth_token`
  3. `encore auth whoami`
  4. `encore app init myproject --lang ts`
  5. `git remote add encore encore://<app-id>`
  6. `git add -A . && git commit -m "init" && git push encore`

