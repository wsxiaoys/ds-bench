# TanStack Router Protected Routes

## Background
Implement a simple authentication flow using TanStack Router. You need to create a public home page, a login page, and a protected dashboard page. The dashboard page should only be accessible to authenticated users.

## Requirements
- Create a new project using TanStack Router.
- Implement a mock authentication context or state (e.g., `isAuthenticated: boolean`, default to `false`).
- Implement route protection using TanStack Router's `beforeLoad` or a similar mechanism.
- **Routes**:
  - `/`: Public home page. Must contain a link with text "Go to Dashboard" pointing to `/dashboard`.
  - `/login`: Login page. Must contain a button with text "Login" that sets the authentication state to true and redirects to `/dashboard`.
  - `/dashboard`: Protected page. If a user is not authenticated, they must be redirected to `/login`. If authenticated, the page must display "Welcome to Dashboard" and contain a "Logout" button that sets authentication to false and redirects to `/login`.
- The application must run on port **6382**.

## Implementation Hints
- You can use Vite with the `@tanstack/router-vite-plugin` and `@tanstack/react-router`.
- Use the `beforeLoad` option in your route definition to check the authentication state and redirect using `throw redirect({ to: '/login' })` if not authenticated.
- You can use React Context to manage and provide the authentication state to the router.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: npm run dev
- Port: 6382
- The app must serve the following routes:
  - GET `/`: Returns the home page with a "Go to Dashboard" link.
  - GET `/login`: Returns the login page with a "Login" button.
  - GET `/dashboard`: If not authenticated, redirects to `/login`. If authenticated, displays "Welcome to Dashboard" and a "Logout" button.
- A correct implementation will always pass the following test criteria:
  1. Navigating to `/dashboard` directly without authentication redirects to `/login`.
  2. Clicking "Login" on the `/login` page authenticates the user and redirects to `/dashboard`.
  3. Clicking "Logout" on the `/dashboard` page deauthenticates the user and redirects to `/login`.

