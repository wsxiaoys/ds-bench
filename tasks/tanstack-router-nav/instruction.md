# Type-safe Navigation Menu with TanStack Router

## Background
Create a basic React application that uses TanStack Router to provide a type-safe navigation menu with active link highlighting.

## Requirements
- Initialize a React project using Vite and TanStack Router.
- Create a file-based routing setup with at least three routes: Home (`/`), About (`/about`), and Contact (`/contact`).
- Create a navigation menu component that links to these routes.
- The navigation links must be type-safe.
- The navigation menu must visually highlight the currently active route by applying a specific CSS class.
- Run the application on port 4273.

## Implementation Hints
- Use `@tanstack/react-router` and its `RouterProvider`, `createRouter`, and file-based routing conventions.
- Utilize the `<Link>` component provided by TanStack Router, which supports `activeProps` to apply properties (like a CSS class) when the link is active.
- Be sure to configure Vite's server port to 4273 in `vite.config.ts` or `vite.config.js`.
- Make sure the `routeTree.gen.ts` file is generated.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm run dev
- Port: 4273
- The app must serve a Home page at `/`, an About page at `/about`, and a Contact page at `/contact`.
- The app must display a navigation menu containing links to all three routes on every page.
- The `<Link>` component for the currently active route MUST have the CSS class `active` applied to it (e.g., `activeProps={{ className: 'active' }}`).
- The routing must be type-safe, meaning the `routeTree.gen.ts` file must exist in the project (typically in `src/routeTree.gen.ts` or `app/routeTree.gen.ts`).

