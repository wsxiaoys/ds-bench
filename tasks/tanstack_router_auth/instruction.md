# TanStack Router Protected Routes

## Background
Implement a simple authentication flow using TanStack Router. You need to create a public home page, a login page, and a protected dashboard page. The dashboard page should only be accessible to authenticated users.

## Requirements
- Create a new project at `/home/user/project` using TanStack Router.
- Implement a mock authentication context or state (e.g., `isAuthenticated: boolean`, default to `false`).
- Implement route protection using TanStack Router's `beforeLoad` or a similar mechanism.
- **Routes**:
  - `/`: Public home page. Must contain a link with text "Go to Dashboard" pointing to `/dashboard`.
  - `/login`: Login page. Must contain a button with text "Login" that sets the authentication state to true and redirects to `/dashboard`.
  - `/dashboard`: Protected page. If a user is not authenticated, they must be redirected to `/login`. If authenticated, the page must display "Welcome to Dashboard" and contain a "Logout" button that sets authentication to false and redirects to `/login`.
- The application must run on port **6382** and start via the `npm run dev` command.

## Implementation Hints
- You can use Vite with the `@tanstack/router-vite-plugin` and `@tanstack/react-router`.
- Use the `beforeLoad` option in your route definition to check the authentication state and redirect using `throw redirect({ to: '/login' })` if not authenticated.
- You can use React Context to manage and provide the authentication state to the router.

