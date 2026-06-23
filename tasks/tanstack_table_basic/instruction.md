# Basic Data Grid with TanStack Table

## Background
Build a simple data grid using TanStack Table in a React application with static data.

## Requirements
- Create a React application with a table component using `@tanstack/react-table`.
- Define static data with at least 3 columns (e.g., `id`, `name`, `email`) and 3 rows.
- Render the table with `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>` HTML elements.
- Ensure the development server runs on port `3145`.

## Implementation Hints
- You can use Vite to create the React app.
- Use `useReactTable` and `getCoreRowModel` from `@tanstack/react-table`.
- Map over `table.getHeaderGroups()` to render headers and `table.getRowModel().rows` to render rows.

## Acceptance Criteria
- Project path: `/home/user/project`
- Start command: `npm run dev` (ensure it is configured to use port `3145`)
- Port: `3145`
- The application must be accessible at `http://localhost:3145`.
- The page must contain a `<table>` element.
- The table must have a `<thead>` containing the column headers (at least 3 `<th>` elements).
- The table must have a `<tbody>` containing at least 3 rows of data (`<tr>` elements with `<td>` cells).

