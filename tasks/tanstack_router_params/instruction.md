# TanStack Router Dynamic Parameters

## Background
Create a simple React application using TanStack Router to demonstrate file-based routing with dynamic parameters.

## Requirements
- Initialize a React project in `/home/user/myproject`.
- Configure TanStack Router with file-based routing.
- Create a home route (`/`) that displays "Home Page".
- Create a dynamic route `/users/$userId` that reads the `userId` parameter and displays "User Profile: <userId>".
- The app must run on port `8765`.

## Implementation Hints
- You can use Vite with a React TypeScript template.
- Install `@tanstack/react-router` and `@tanstack/router-plugin` (or `@tanstack/router-vite-plugin`).
- Configure the Vite plugin to generate the route tree automatically.
- Create the routing files in `src/routes/`.
- Ensure your `vite.config.ts` or package.json scripts are configured to start the dev server on port `8765`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm run dev
- Port: 8765
- Routes to verify:
  - GET `/`: The page must render text containing "Home Page".
  - GET `/users/<userId>`: The page must render text containing "User Profile: <userId>" matching the dynamic parameter in the URL.

