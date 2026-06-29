# Multi-Client Collaborative Drawing Board (Reflex)

## Background
Build a Reflex application that powers a multi-client collaborative drawing board. Stroke segments are persisted in SQLite and pushed to every connected client via a background polling task that refreshes the in-memory state. The page renders the strokes as `<line>` elements inside an SVG using `rx.foreach`.

A REST surface mounted on the Reflex FastAPI backend (via `api_transformer`) must allow external clients to create and list stroke segments. The page UI itself only needs to render the strokes; HTTP is the contract used to verify behavior.

## Requirements
- Reflex app located at `/home/user/myproject` with an SQLite database `reflex.db` in the same directory.
- A persisted `Stroke` table (an `rx.Model` with `table=True`) holding one drawn segment per row. The table must have the columns: `id` (integer primary key), `x1` (real/float), `y1` (real/float), `x2` (real/float), `y2` (real/float), `color` (text), and `session_id` (text).
- A reactive page state that exposes `strokes: list[Stroke]` synchronized to the browser.
- A background task (`@rx.event(background=True)`) that refreshes the state from the DB approximately every 250 ms.
- Two REST endpoints, mounted on the backend via `api_transformer`, that create and list strokes. They must be available on the backend port (8000):
  - `POST /api/strokes`: Accepts a JSON body with `x1`, `y1`, `x2`, `y2` (numbers), `color`, and `session_id` (strings). Returns HTTP 201 with the created stroke object (including the generated integer `id`). This must insert exactly 1 row into the `stroke` table.
  - `GET /api/strokes`: Returns HTTP 200 with a JSON array of all stroke objects in insertion order.
- Index page (`/`) that renders an `<svg>` containing one `<line>` per stroke through `rx.foreach`.

## Implementation Hints
- Use `uv` to manage the project: `uv init`, `uv add reflex`, `uv run reflex init --template blank`, `uv run reflex db init`, `uv run reflex db makemigrations --message ...`, `uv run reflex db migrate`.
- Model state mutation inside background events with `async with self:` to avoid `ImmutableStateError`.
- For SVG elements use `rx.el.svg`, `rx.el.svg.line`, etc.
- The REST endpoints can be attached using `rx.App(api_transformer=fastapi_app)`. The application will be tested by running the backend only on port 8000 (`uv run reflex run --backend-only --backend-port 8000`). Ensure the default Reflex internal health endpoint `GET /ping` continues to return `"pong"`.
- After the app is running, leave it running for verification, but **kill every background server you started** (including `reflex run`, `next dev`, anything bound to ports 8000/3000) before reporting completion.

