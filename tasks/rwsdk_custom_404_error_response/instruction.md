# RedwoodSDK: Custom 404 & ErrorResponse Handling

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Implement a custom 404 page (rendered as React JSX) and demonstrate `ErrorResponse` short-circuiting from `rwsdk/worker`.

## Requirements
Implement the routes below. The 404 page must be rendered through React (JSX). The `ErrorResponse` route demonstrates throwing an `ErrorResponse` instance.

## Acceptance Criteria
- Project path: /home/user/myapp
- Start command: npm run dev -- --host 0.0.0.0 --port 5173
- Port: 5173
- Routes:
  - `GET /home` returns JSX whose HTML contains the text `Welcome home`.
  - Any unmatched URL (e.g. `/does-not-exist`, `/nope/whatever`) must respond with status 404 and HTML containing `<h1>Page Not Found</h1>` and the text `The page you requested could not be found.`.
  - `GET /boom` must throw `new ErrorResponse(418, "Short and stout")` from inside its handler. The framework's default behaviour must surface a 418 response. The response body must contain the substring `Short and stout`.
  - `GET /healthcheck` returns `Response` with body `ok` and status 200.

