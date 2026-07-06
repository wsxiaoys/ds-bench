# RedwoodSDK: Custom 404 & ErrorResponse Handling

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Implement a custom 404 page (rendered as React JSX) and demonstrate `ErrorResponse` short-circuiting from `rwsdk/worker`.

To start the development server, use:
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Requirements
Implement the following routes and features in the RedwoodSDK project:

1. **`GET /home`**: Returns JSX whose HTML contains the text `Welcome home`.
2. **Custom 404 Page**: Any unmatched URL (e.g., `/does-not-exist`, `/nope/whatever`) must respond with HTTP status code `404` and HTML containing `<h1>Page Not Found</h1>` and the text `The page you requested could not be found.`. The 404 page must be rendered through React (JSX).
3. **`GET /boom`**: Must throw `new ErrorResponse(418, "Short and stout")` from inside its handler. The framework's default behavior must surface a 418 response, and the response body must contain the substring `Short and stout`.
4. **`GET /healthcheck`**: Returns `Response` with body `ok` and status 200.

