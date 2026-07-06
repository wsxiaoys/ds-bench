# Notes & Tags CRUD App with Many-to-Many Filtering (Reflex)

## Background

Build a Reflex application that manages notes labelled with tags. The data model is a classic **many-to-many** relationship between `Note` and `Tag`, joined by an SQLModel **link table**. The UI must support full CRUD over notes, attach/detach of tags (including creating new tags on the fly), and a `selected_tags` filter that uses `rx.foreach` + `rx.cond` to filter the displayed notes. The State must expose a cached computed var `all_tags` that publishes the union of tag names attached to at least one note.

A non-Reflex CLI helper `probe.py` at the project root must expose the same data layer over stdin/stdout so the verifier can drive the schema deterministically without a browser.

## Requirements

- Three SQL models inside the Reflex app:
  - A `Note` model (subclass of `rx.Model`, `table=True`) with at least an `id` primary key and a `content: str` field.
  - A `Tag` model (subclass of `rx.Model`, `table=True`) with at least an `id` primary key and a `name: str` field whose values are unique.
  - A separate **link table** model (subclass of `rx.Model`, `table=True`) that holds the foreign keys to `note.id` and `tag.id` and joins the two via `sqlmodel.Relationship(..., link_model=...)`. The `Note.tags` and `Tag.notes` relationships must both be configured.
- A Reflex `State` whose synchronized base vars include at least:
  - `notes`: the list of notes currently displayed (after filtering).
  - `selected_tags`: the list of tag names the user is filtering by.
- A cached computed var `all_tags` on that State that returns the union of tag names currently attached to at least one note (sorted, no duplicates).
- An index route (`/`) UI that:
  - Renders the list of notes via `rx.foreach`, where each note row uses `rx.cond` to decide whether to show based on `selected_tags` (a note is shown when `selected_tags` is empty, or when at least one of its tags is in `selected_tags`).
  - Supports creating a new note with content and a list of tag names (autocomplete from existing tags is allowed but not required; typing a new tag name MUST create the corresponding `Tag` row if it does not already exist).
  - Supports editing a note's content and replacing its full tag set.
  - Supports deleting a note. Deleting a note must remove its link rows but MUST NOT delete the referenced tag rows.
  - Supports toggling tags into / out of `selected_tags`.
- A CLI helper `probe.py` at the project root (`/home/user/myproject/probe.py`) that uses the **same** `rx.Model` classes and the same database file (SQLite at `/home/user/myproject/reflex.db`). The CLI helper is invoked as `uv run python probe.py <subcommand> [args]`. Every subcommand must print exactly one JSON object on its own line on stdout (the verifier parses the last JSON object on stdout; extra log lines are tolerated). Exit code must be 0 on success and non-zero on failure. It must support the following subcommands:
  - `counts`:
    - Returns: `{"notes": <int>, "tags": <int>, "links": <int>}` reflecting `SELECT COUNT(*)` of the note, tag, and link tables.
  - `ensure-tag --name <NAME>`:
    - Creates a `Tag` row with `name == NAME` if and only if it does not already exist. Idempotent.
    - Returns: `{"id": <int>, "name": <NAME>, "created": <bool>}`.
  - `create --content <TXT> --tags <T1,T2,...>`:
    - Creates one `Note` row. For each comma-separated tag name in `--tags`, attaches that `Tag` to the new note, creating the `Tag` row only if no row with that exact `name` already exists.
    - `--tags` is optional. If absent or empty, the note is created without tags.
    - Returns: `{"id": <int>, "content": <TXT>, "tags": [<sorted tag names>]}`.
  - `list [--filter <T1,T2,...>]`:
    - When `--filter` is missing or empty, returns all notes in ascending `id` order.
    - When `--filter` has at least one tag, returns notes that have at least one tag in the filter (OR semantics), in ascending `id` order.
    - Returns: `{"notes": [{"id": <int>, "content": <str>, "tags": [<sorted tag names>]}, ...]}`.
  - `set-tags --id <N> --tags <T1,T2,...>`:
    - Replaces the entire tag set of the note with id `N` with the comma-separated tags. Creates missing `Tag` rows as needed. Removes link rows for tags no longer attached. Never deletes `Tag` rows.
    - Returns: `{"id": <N>, "tags": [<sorted tag names>]}`.
  - `update --id <N> --content <TXT>`:
    - Updates the `content` of the note with id `N`. Does not touch its tags.
    - Returns: `{"id": <N>, "content": <TXT>}`.
  - `delete --id <N>`:
    - Deletes the note with id `N` and all its rows in the link table. Does NOT delete any `Tag` row.
    - Returns: `{"id": <N>, "deleted": true}`.
  - `all-tags`:
    - Returns: `{"all_tags": [<sorted tag names that are attached to at least one note>]}`. Tag rows that exist in the `tag` table but are not currently attached to any note MUST NOT appear.

## Implementation Hints

- The project path is `/home/user/myproject`.
- Use the project setup flow from the research plan (`uv init`, `uv add reflex`, `uv run reflex init --template blank`, `uv run reflex db init/makemigrations/migrate`). Keep all Python deps inside the `uv`-managed virtual environment; the verifier will invoke Python through `uv run`.
- The application should run on port `3000` (frontend) and `8000` (backend), and be startable using `uv run reflex run --loglevel info` from the project directory. The UI will be verified on `http://localhost:3000/`.
- The database must be an SQLite database located at `/home/user/myproject/reflex.db`. After `uv run reflex db migrate`, the schema must contain:
  - A `note` table (with at least `id` and `content` columns).
  - A `tag` table (with at least `id` and `name` columns).
  - A separate link table (e.g., `notetaglink` or any name) with exactly two columns which are FOREIGN KEYs into `note.id` and `tag.id`.
- The link table is its own `rx.Model` with `table=True` and two `Field(..., foreign_key=...)` columns that together form the primary key. Wire the many-to-many with `sqlmodel.Relationship(back_populates=..., link_model=<LinkTable>)`.
- For the filter UI, do not pre-filter on the backend just for display; perform the filter inside `rx.foreach` using `rx.cond` against `selected_tags` so the UX matches the requirements. (You may still query a sorted list of notes from the DB.)
- For `all_tags`, use `@rx.var(cache=True)` and derive it from the same data the State already holds for notes (or read from DB) so it stays in sync after CRUD operations.
- After you have finished developing, **kill all background servers** you started (e.g. `uv run reflex run`). The verifier starts the server itself.

