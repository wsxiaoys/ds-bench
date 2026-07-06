# Type-safe Navigation Menu with TanStack Router

## Background
Create a basic React application that uses TanStack Router to provide a type-safe navigation menu with active link highlighting.

## Requirements
- Initialize the React project at `/home/user/myproject` using Vite and TanStack Router.
- Create a file-based routing setup with at least three routes: Home (`/`), About (`/about`), and Contact (`/contact`).
- Create a navigation menu component that links to these routes.
- The navigation links must be type-safe.
- The navigation menu must visually highlight the currently active route by applying the `active` CSS class to the active link.
- Configure the application to run on port 4273, started via `npm run dev`.

## Implementation Hints
- Use `@tanstack/react-router` and its `RouterProvider`, `createRouter`, and file-based routing conventions.
- Utilize the `<Link>` component provided by TanStack Router, which supports `activeProps` to apply properties (like `activeProps={{ className: 'active' }}`) when the link is active.
- Be sure to configure Vite's server port to 4273 in `vite.config.ts` or `vite.config.js`.
- Make sure the `routeTree.gen.ts` file is generated (typically in `src/routeTree.gen.ts` or `app/routeTree.gen.ts`).

