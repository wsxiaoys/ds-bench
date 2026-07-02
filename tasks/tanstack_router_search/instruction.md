# TanStack Router Search Page

## Background
Build a "Search" page where all filters are synced to the URL using TanStack Router.

## Requirements
- Create a React application using TanStack Router in `/home/user/project`.
- The application should start with `npm run dev` and listen on port 4821.
- Implement a `/search` route.
- The page must sync the following filters to the URL search parameters: `q` (string), `category` (string), `minPrice` (number), and `maxPrice` (number).
- The page must contain `<input>` elements for each of these filters, identifiable by their `name` attributes set to `q`, `category`, `minPrice`, and `maxPrice` respectively.
- Modifying the inputs must update the URL search parameters, and loading the page with URL search parameters must populate the inputs with the corresponding values.

## Implementation Hints
- You can use Vite to scaffold the React app.
- Use `@tanstack/react-router` and its search param validation features.
- Update your `vite.config.ts` or package.json to ensure the dev server runs on port 4821.

