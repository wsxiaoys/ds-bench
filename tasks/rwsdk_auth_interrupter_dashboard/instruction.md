# RedwoodSDK: Auth Interrupter Protecting a Dashboard

## Background
You are extending a freshly scaffolded RedwoodSDK (`rwsdk`) project. Build a session-based authentication flow that protects a `/dashboard` route using rwsdk's **interrupter** pattern (per-route middleware that may short-circuit a request with a `Response`). Unauthenticated visitors must be redirected to `/login`; authenticated visitors must see their username on the dashboard; a logout endpoint must clear the session.

## Requirements
- The web app is a RedwoodSDK project served by `npm run dev` on port 5173 (Vite + Cloudflare workerd).
- Provide the following routes:
  - `GET /` — any public landing page.
  - `GET /login` — renders an HTML page (status 200) containing an HTML `<form>` with `method="post"` and two input elements named exactly `username` and `password`.
  - `POST /login` — accepts `application/x-www-form-urlencoded` body with fields `username` and `password`. On valid credentials, creates a session and redirects to `/dashboard` (status 302). On invalid credentials, re-renders the login page with a human-readable error message (containing the word 'invalid', case-insensitive) and status `401`, and must NOT set a populated `session` cookie.
  - `GET /dashboard` — protected by an `isAuthenticated` interrupter. Authenticated users see a page containing their username (e.g., 'demo'). Unauthenticated users are redirected (status 302) to `/login`.
  - `POST /logout` — clears the session cookie and redirects (status 302) to `/login`.
- Hardcode at least one demo credential pair in an in-memory or JSON user store. The pair `demo` / `pass` MUST be valid (the verifier signs in with it).
- Use rwsdk's interrupter pattern from `rwsdk/router` / `rwsdk/worker` to gate `/dashboard`. The interrupter function must live in the application source under `src/` and be passed into the route definition for `/dashboard` using the array form (e.g., `route('/dashboard', [isAuthenticated, dashboardHandler])`). The interrupter must inspect the request/ctx and return/throw a `Response` when not authenticated.
- The session cookie must be named `session`. Set it on successful login via a `Set-Cookie` response header with `HttpOnly` and `Path=/` attributes. Clear it on logout by setting a `Set-Cookie` header with `Max-Age=0` (or equivalent past Expires, or an empty value).
- The session cookie value must be cryptographically signed (HMAC) so it cannot be forged. The signing secret must be read from the `/home/user/session_secret.txt` file. A request to `GET /dashboard` carrying a `session` cookie whose value has been tampered with (any character flipped in the signature portion) must not be treated as authenticated — it must redirect (302) to `/login` just like a missing cookie.

## Implementation Hints
- Start from the existing scaffold at the project path `/home/user/myproject`; the `rwsdk` dependency and Vite config are already installed.
- Read https://docs.rwsdk.com/llms-full.txt or the Authentication / Routing sections of https://docs.rwsdk.com for `defineApp`, `route`, interrupters, and session handling patterns.
- Interrupters are simply functions placed before the final handler in a `route(path, [interrupter, handler])` array.
- You can implement signed cookies with the Web Crypto API (`crypto.subtle.sign` with HMAC-SHA256) — no extra npm package required.
- Use `Response.redirect(url, 302)` or `new Response(null, { status: 302, headers: { Location: '/login', 'Set-Cookie': '...' } })` to redirect.
- Keep the user store trivial (a constant object/array of `{ username, password }`). This is an evaluation app, not production.

