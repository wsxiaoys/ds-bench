# Server-Driven Employee Data Grid (TanStack Start + Router + Table + SQLite)

## Background
Build a full-stack, single-page data grid with **TanStack Start**. The grid must perform **server-side** pagination, sorting (including multi-column sorting), and global text filtering against a **SQLite** database. Every piece of table state (page, page size, sort, and the global filter) must be encoded in the URL search params, validated with **Zod**, so the view is shareable, survives a full reload, and works with the browser Back/Forward buttons. The data must be produced by the server (a TanStack Start server function for the page, plus a REST endpoint), never filtered/sorted/paged in the browser.

## Requirements
- A TanStack Start application whose index route `/` renders an interactive employee grid built with **TanStack Table** (headless) in fully controlled mode (manual pagination, sorting, and filtering).
- The route must declare and validate its URL search params with a **Zod** schema through TanStack Router's search-param validation, providing the defaults listed below. Invalid search params on the page must NOT crash the server (fall back to defaults).
- The page's data must be produced **server-side** by a TanStack Start **server function** that reads the validated search params and queries SQLite. Filtering, sorting, and pagination are all computed on the server.
- A REST endpoint `GET /api/employees` served by the same app performs the identical server-side query against SQLite and returns JSON.
- The dataset is the fixed 24-row seed table below, stored in a SQLite database. Ship exactly this data — do not add, remove, rename, or renumber rows.
- The app must listen on the port given in *Acceptance Criteria*.

## Seed Dataset (exactly these 24 rows)
Columns and types: `id: number`, `name: string`, `email: string`, `department: string`, `salary: number`.

| id | name          | email                        | department  | salary |
|----|---------------|------------------------------|-------------|--------|
| 1  | Alice Johnson | alice.johnson@corp.test      | Engineering | 95000  |
| 2  | Bob Smith     | bob.smith@corp.test          | Sales       | 62000  |
| 3  | Carol Nguyen  | carol.nguyen@corp.test       | Engineering | 88000  |
| 4  | David Lee     | david.lee@corp.test          | Support     | 54000  |
| 5  | Emma Brown    | emma.brown@corp.test         | Design      | 71000  |
| 6  | Frank Wilson  | frank.wilson@corp.test       | Sales       | 67000  |
| 7  | Grace Kim     | grace.kim@corp.test          | Engineering | 102000 |
| 8  | Henry Davis   | henry.davis@corp.test        | Support     | 58000  |
| 9  | Ivy Martinez  | ivy.martinez@corp.test       | Design      | 76000  |
| 10 | Jack Nguyen   | jack.nguyen@corp.test        | Sales       | 69000  |
| 11 | Karen Miller  | karen.miller@corp.test       | Support     | 60000  |
| 12 | Leo Garcia    | leo.garcia@corp.test         | Engineering | 91000  |
| 13 | Mia Rodriguez | mia.rodriguez@corp.test      | Design      | 73000  |
| 14 | Noah Anderson | noah.anderson@corp.test      | Sales       | 64000  |
| 15 | Olivia Thomas | olivia.thomas@corp.test      | Engineering | 99000  |
| 16 | Paul Nguyen   | paul.nguyen@corp.test        | Support     | 57000  |
| 17 | Quinn Taylor  | quinn.taylor@corp.test       | Design      | 78000  |
| 18 | Ruby Moore    | ruby.moore@corp.test         | Sales       | 66000  |
| 19 | Sam Jackson   | sam.jackson@corp.test        | Engineering | 105000 |
| 20 | Tina White    | tina.white@corp.test         | Support     | 59000  |
| 21 | Uma Harris    | uma.harris@corp.test         | Design      | 74000  |
| 22 | Victor Clark  | victor.clark@corp.test       | Sales       | 63000  |
| 23 | Wendy Lewis   | wendy.lewis@corp.test        | Engineering | 97000  |
| 24 | Xander Walker | xander.walker@corp.test      | Support     | 56000  |

## URL / Query Contract (shared by `/` and `/api/employees`)
Both the page URL search string and the `/api/employees` query string use exactly these first-level parameters:
- `q` (string) — global filter. Case-insensitive substring match against `name` OR `email`. Default `""` (no filtering).
- `sort` (string) — a comma-separated list of `field:direction` tokens defining the sort order (first token is the primary sort key, then secondary, etc.). `field` is one of `id`, `name`, `email`, `department`, `salary`; `direction` is `asc` or `desc`. Default `id:asc`.
- `page` (integer, 1-based). Default `1`.
- `pageSize` (integer, 1..100). Default `8`.

`GET /api/employees` response body (HTTP 200) is a JSON object with exactly these keys:
```json
{
  "rows": [{ "id": number, "name": string, "email": string, "department": string, "salary": number }],
  "total": number,
  "page": number,
  "pageSize": number,
  "pageCount": number
}
```
- `total` is the number of rows matching the filter, before pagination.
- `pageCount` is the number of pages, i.e. ceil(total / pageSize) (and at least 1).
- `rows` is the page slice after filtering, then sorting, then pagination.

Validation for `GET /api/employees`: any invalid parameter (e.g. `page` less than 1, non-integer `page`/`pageSize`, `pageSize` outside 1..100, an unknown sort field, or an invalid sort direction) must return HTTP **400** with a JSON body `{ "error": string }` (non-empty message).

## Server-rendered page contract
- `GET /` returns HTML (status 200). The server-rendered HTML must contain, as plain text, the `name` of every row on the currently displayed page (respecting the `q`, `sort`, `page`, `pageSize` search params). It must NOT contain the names of rows that belong to other pages of the current result set.
- Invalid page search params (e.g. `GET /?page=abc`) must still return HTTP 200 (defaults applied), not a 500.

## Interactive UI contract (rendered on `/`)
The grid is driven entirely by the URL search params; changing any control updates the URL and re-fetches server data. The DOM MUST expose these stable hooks so the behavior can be automated:
- The global-filter text box is an `<input>` with attribute `data-testid="global-filter"`. Submitting it by pressing **Enter** applies the filter: it writes the current text to `q` in the URL, resets `page` to `1`, and creates a new browser history entry.
- Each column header has a clickable sort control with attribute `data-testid="sort-<field>"` for `<field>` in `id`, `name`, `email`, `department`, `salary`. Clicking a column's control sorts by that single column ascending; clicking the same column's control again toggles the direction to descending. The resulting sort MUST be reflected in the URL `sort` parameter.
- A "next page" control with `data-testid="next-page"` and a "previous page" control with `data-testid="prev-page"` change `page` while preserving the other params.
- Each rendered data row exposes its employee name inside an element with `data-testid="cell-name"`; the DOM order of these elements matches the displayed row order.
- An element with `data-testid="total-count"` whose text content is the integer `total` (number of rows matching the current filter, before pagination).
- The URL query string must always reflect the current state using the same `q`, `sort`, `page`, `pageSize` parameters and formats as the API. Reloading the page must reproduce the exact same grid state from the URL, and the browser Back/Forward buttons must move between previously visited grid states.

## Implementation Hints
- Project path: /home/user/project
- Start command: npm run start
- Port: 34517 (the app — both `/` and `/api/employees` — must listen on this port when started with `npm run start`).
- Use these exact dependency versions: `react@19.2.8`, `react-dom@19.2.8`, `@tanstack/react-start@1.168.32`, `@tanstack/react-router@1.170.18`, `@tanstack/react-table@8.21.3`, `vite@8.1.5`, `@vitejs/plugin-react@6.0.4`, `typescript@5.9.3`, `zod@4.4.3`. For SQLite you may use `better-sqlite3@13.0.1` (or Node's built-in `node:sqlite`); the data must be backed by a SQLite database.
- Filtering, sorting, and pagination MUST be performed on the server (in the server function and the API handler that query SQLite), not in the browser.

