# Basic Data Grid with TanStack Table

## Background
Build a simple data grid using TanStack Table in a React application with static data.

## Requirements
- Create a React application in `/home/user/project` with a table component using `@tanstack/react-table`.
- Define static data with at least 3 columns (e.g., `id`, `name`, `email`) and 3 rows.
- Render the table with `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>` HTML elements.
- Ensure the development server runs on port `3145` and can be started with `npm run dev`.

## Implementation Hints
- You can use Vite to create the React app.
- Use `useReactTable` and `getCoreRowModel` from `@tanstack/react-table`.
- Map over `table.getHeaderGroups()` to render headers and `table.getRowModel().rows` to render rows.

