# TanStack Router Search Page

## Background
Build a "Search" page where all filters are synced to the URL using TanStack Router.

## Requirements
- Create a React application using TanStack Router.
- Implement a `/search` route.
- The page must sync the following filters to the URL search parameters: `q` (string), `category` (string), `minPrice` (number), and `maxPrice` (number).
- The page must contain `<input>` elements for each of these filters.
- Use port 4821 for the application.

## Implementation Hints
- You can use Vite to scaffold the React app.
- Use `@tanstack/react-router` and its search param validation features.
- Update your `vite.config.ts` or package.json to ensure the dev server runs on port 4821.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: npm run dev
- Port: 4821
- Route `/search` must exist and validate `q`, `category`, `minPrice`, and `maxPrice` as search params.
- The page must have input fields identifiable by their `name` attributes: `q`, `category`, `minPrice`, and `maxPrice`.
- Modifying the inputs must update the URL search parameters.
- Loading the page with URL search parameters must populate the inputs with the corresponding values.

