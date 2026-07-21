# Qwik City Blog CMS backed by local SQLite

## Background
You are building a small, self-contained blog CMS using the Qwik meta-framework **Qwik City** (`@builder.io/qwik` + `@builder.io/qwik-city`, v1.x). A minimal Qwik City app has already been scaffolded and its dependencies installed at the project path below. All data must live in a **local SQLite database file** — there are no external services, APIs, or network dependencies.

The app must render blog content on the server with `routeLoader$`, mutate content with `routeAction$` (validated with `zod$`), expose individual posts through slug-based dynamic routes, and keep all database code strictly server-side so that no database driver or SQL leaks into the client bundle.

## Requirements
- Persist posts in a local SQLite file. You may use either `better-sqlite3` or Prisma; either way the database must live at `data/blog.db` (relative to the project root) and expose a table named exactly `posts` with these columns: `id` (integer primary key, autoincrement), `slug` (text, unique, not null), `title` (text, not null), `content` (text, not null), `published` (integer, not null, default `0`, storing `0` or `1`), `created_at` (text, not null, ISO-8601 timestamp).
- The table must be created automatically if it does not already exist when the app boots (do not require a manual migration step to run the app).
- Public site:
  - `GET /` lists **only published** posts (`published = 1`), newest first (descending `created_at`). Each entry must show the post title and link to `/posts/<slug>/`.
  - `GET /posts/<slug>/` renders a single post's title and content. If no post with that slug exists it must respond with HTTP status `404`.
- Admin site:
  - `GET /admin/` lists **all** posts (drafts and published). For every post it must provide a link to its edit page at `/admin/<slug>/edit/` and a control to delete it. It must also link to the create page `/admin/new/`.
  - `GET /admin/new/` shows a create form.
  - `GET /admin/<slug>/edit/` shows an edit form pre-filled with the existing post.
- Create, edit and delete must be implemented with `routeAction$` submitted through the Qwik City `<Form>` component (progressive enhancement), validated server-side with `zod$`.
- Database access code must be server-only: it must never be included in the client-side production bundle.

## Implementation Hints
- Project path: `/home/user/blog-cms`
- Use `routeLoader$` for all reads and `routeAction$` + `zod$` for all writes; keep every SQLite import and query inside server-only boundaries (e.g. a `*.server.ts` module and/or code that only runs inside loaders/actions) so the optimizer tree-shakes it out of client chunks.
- The create and edit forms must submit these exact field names: `title`, `slug`, `content`, and `published` (a checkbox). The delete form must submit the target post's `slug`.
- Validation rules enforced server-side with zod (invalid submissions must be rejected, must NOT touch the database, and must re-render the form showing an error instead of crashing):
  - `title`: string, at least 3 characters.
  - `slug`: string matching the kebab-case pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
  - `content`: string, at least 1 character.
  - `published`: interpreted as a boolean (checkbox present/checked = published).
- Enforce slug uniqueness: attempting to create a post whose slug already exists must fail and must NOT create a duplicate row.
- `created_at` must be assigned by the server at creation time; never trust a client-supplied timestamp.
- Newly created posts with `published` unchecked are drafts: they must appear in `/admin/` but must NOT appear on `/`.
- Start command (SSR dev server): `npm run dev -- --port 3000 --host 0.0.0.0`
- Port: 3000
- The production build command `npm run build` must complete successfully, and the resulting client bundle (the `dist/` directory) must NOT contain any reference to the SQLite driver, Prisma client, raw SQL, or the `blog.db` file — proving the database layer stays on the server.

