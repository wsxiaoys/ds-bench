# Full-Stack TanStack Start Kanban Board

## Background
Build a full-stack Kanban / Trello-style board with **TanStack Start** (React full-stack framework), **TanStack Query** for client cache, and a local **SQLite** database. The board has multiple columns, each holding an ordered list of cards. Cards can be reordered within a column and moved between columns using drag-and-drop, and every change must be persisted server-side so it survives a full page reload.

## Requirements
- Implement the app with TanStack Start. All persistence mutations (moving/reordering cards) MUST go through TanStack Start **Server Functions** (`createServerFn`) and write to SQLite. Do not persist board state only in the browser.
- The board has exactly three columns, shown left-to-right in this order:
  1. `id` = `todo`, title = `Todo`
  2. `id` = `in-progress`, title = `In Progress`
  3. `id` = `done`, title = `Done`
- On startup, if the database has no cards yet, seed it with exactly these six cards (each card has a unique title), placed top-to-bottom in the given columns:
  - `Todo`: `Write project spec`, `Design database schema`, `Set up CI pipeline`
  - `In Progress`: `Implement board UI`, `Wire up server functions`
  - `Done`: `Kickoff meeting`
- Each card has a stable integer `id`, a `title`, the column it belongs to, and an ordering value (`position`) that determines its top-to-bottom order within its column.
- The card ordering value MUST remain a **contiguous, zero-based** integer sequence within each column at all times (i.e. after any move, the cards in a column have positions `0, 1, 2, ...` with no gaps and no duplicates). Moves must be applied atomically so this invariant always holds.
- Support drag-and-drop in the browser to (a) reorder a card within its column and (b) move a card to a different column at a chosen position. Use TanStack Query so the UI updates optimistically, and reconcile with the server so the persisted order is authoritative after a reload.
- Use a local drag-and-drop library only. No external/cloud services, external databases, third-party network calls, or internet access are available at run time.

## Implementation Hints
- Project path: `/home/user/project`
- Start command: `npm run start` (this command must build if necessary and serve the running application).
- Port: the application MUST listen on `http://localhost:34517`.
- SQLite database file path: `/home/user/project/data/kanban.sqlite`. The app must create and seed it on first startup if it does not already exist.
- Read endpoint (used to inspect persisted board state): `GET /api/board` MUST return status `200` and a JSON body with this exact shape:

  ```json
  {
    "columns": [
      {
        "id": "todo",
        "title": "Todo",
        "cards": [
          { "id": 1, "title": "Write project spec", "position": 0 }
        ]
      }
    ]
  }
  ```

  - The `columns` array MUST contain the three columns in the order `todo`, `in-progress`, `done`.
  - Within each column, the `cards` array MUST be ordered by `position` ascending, and `position` values MUST be contiguous starting at `0`.
  - Each card object MUST contain exactly the keys `id` (integer), `title` (string), and `position` (integer).
- The root route `/` MUST render the board: three visible columns titled `Todo`, `In Progress`, and `Done`, each showing its cards as draggable elements labeled by their titles.
- Dragging a card and dropping it in a new position or column MUST persist the new order; after reloading `/`, and when re-fetching `GET /api/board`, the new order MUST be reflected.
- Dependency versions (pin these exact versions in `package.json`):
  - `react`: `19.2.8`
  - `react-dom`: `19.2.8`
  - `@tanstack/react-start`: `1.168.32`
  - `@tanstack/react-router`: `1.170.18`
  - `@tanstack/react-query`: `5.101.4`
  - `@tanstack/router-plugin`: `1.168.23`
  - `vite`: `8.1.5`
  - `@vitejs/plugin-react`: `6.0.4`
  - `typescript`: `7.0.2`
  - `zod`: `4.4.3`
  - `better-sqlite3`: `13.0.1`
  - `@types/better-sqlite3`: `7.6.13`
  - `@dnd-kit/core`: `6.3.1`
  - `@dnd-kit/sortable`: `10.0.0`

