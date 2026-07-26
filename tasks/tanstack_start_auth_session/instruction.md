# Full-Stack Session Authentication with TanStack Start

## Background
Build a complete, session-based authentication system as a full-stack **TanStack Start** (React) application. The app must support user registration and login backed by a local SQLite database, server-side sessions delivered through an HTTP-only cookie, and protected routes guarded by TanStack Router. No external services, network APIs, or third-party auth providers may be used — everything runs locally.

A TanStack Start (React) application scaffold, with TanStack Router file-based routing and all dependencies already installed, is provided at the project path below. Implement the authentication system inside it.

## Requirements
- **Registration** (`/register`): Create a new account from a username and password. Passwords must be stored **hashed** — the plaintext password must never be persisted. On successful registration the user becomes authenticated and lands on `/dashboard`.
- **Login** (`/login`): Authenticate an existing user by username and password. Correct credentials establish an authenticated session; incorrect credentials are rejected, keep the user unauthenticated, keep them on `/login`, and surface a visible error message.
- **Logout**: From `/dashboard`, a control labeled `Logout` ends the session. Logout must invalidate the session **server-side**, not merely drop the client cookie: a previously-issued session cookie must no longer grant access after logout.
- **Protected routes**: `/dashboard` and `/dashboard/settings` require authentication. An unauthenticated request to any protected route must redirect to `/login` while preserving the originally requested URL so the user is returned there after a successful login. Route protection must be enforced through the TanStack Router route lifecycle (`beforeLoad`) and backed by a server-side authorization check.
- **Current user**: Expose a TanStack Start server function that returns the currently authenticated user (at minimum the `username`) or a null/empty result when no valid session exists. The dashboard must display the authenticated user's `username`.
- **Persistence**: Users and sessions must be persisted in a local SQLite database.
- **Session transport**: The session identifier must travel in an **HTTP-only** cookie so it is not readable from client-side JavaScript. Do not store the session token in `localStorage`, `sessionStorage`, or any JavaScript-accessible cookie.

## Implementation Hints
- Project path: `/home/user/tanstack-auth`
- The application is served over plain HTTP on `localhost`. Ensure the session cookie is actually sent by the browser in this environment (do not require HTTPS for the cookie to function).
- Build the production app with `npm run build` and serve it with `npm run start`. The production server must listen on port **8791** (it must honor the `PORT` environment variable, which the verifier sets to `8791`).
- Persist all data in a SQLite database file located at exactly `/home/user/tanstack-auth/data/app.db`.
- Forms must use these exact field names so they can be driven programmatically:
  - Registration form (`/register`): a text input with `name="username"`, a password input with `name="password"`, and a submit control.
  - Login form (`/login`): a text input with `name="username"`, a password input with `name="password"`, and a submit control.
- The logout control on `/dashboard` must be an element whose visible, accessible text is `Logout`.
- When an unauthenticated user is redirected to the login page, the destination must be `/login` with a search (query) parameter named `redirect` whose value is the originally requested path (including any sub-path and query string). After a successful login, navigate the user to the path carried in that `redirect` parameter; if it is absent, navigate to `/dashboard`.
- Two distinct protected routes are required: `/dashboard` and the nested `/dashboard/settings`.

