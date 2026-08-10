# Many-to-Many Filtering & Pagination Query in Wasp

## Background
You are working in a scaffolded [Wasp](https://wasp.sh) full-stack application (Wasp `0.16.2`, React + Node.js + Prisma). Wasp lets you declare your data model in `schema.prisma` and expose server-side Operations (Queries/Actions) that are automatically served over HTTP. The app is a small blog whose posts can be labeled with reusable tags. Your job is to model a many-to-many relationship and expose a single, powerful read Query that filters, sorts, and paginates posts.

## Requirements
- Model two entities in `schema.prisma` with a **many-to-many** relationship:
  - `Post`: `id` (Int, primary key, autoincrement), `title` (String), `createdAt` (DateTime, defaults to now), and a many-to-many relation field `tags`.
  - `Tag`: `id` (Int, primary key, autoincrement), `name` (String, unique), and the back-relation field `posts`.
  - The relation between `Post` and `Tag` must be a Prisma **implicit** many-to-many relation (`tags Tag[]` on `Post` and `posts Post[]` on `Tag`; no explicit join model).
- Implement a Wasp **Query** named exactly `getPosts` (declared in the Wasp file with both `Post` and `Tag` listed as its entities) that filters, sorts, and paginates posts.

## Evaluation-Specific Constraints
- Project path: `/home/user/blog`. The project is an already-scaffolded Wasp app whose database is a local PostgreSQL instance (the Prisma datasource provider is already set to `postgresql` and the connection string is supplied via the `DATABASE_URL` environment variable). Do not change the datasource provider.
- Start command: `wasp start`. The Wasp server listens on port `3001`. The `getPosts` Query must be public (no authentication) so it is reachable through Wasp's auto-generated operations HTTP route.
- The `getPosts` Query accepts a single arguments object with exactly these fields:
  - `tagNames`: an array of strings. Optional. When present and non-empty, only posts that are associated with **ALL** of the listed tag names are included (AND semantics, not OR). When omitted or an empty array, no tag filtering is applied.
  - `page`: an integer `>= 1`, the 1-based page index.
  - `pageSize`: an integer `>= 1`, the number of posts per page.
  - `sortBy`: an object `{ "field": "createdAt" | "title", "direction": "asc" | "desc" }` describing the primary ordering.
- The Query must return an object with exactly two keys:
  - `posts`: the array of posts on the requested page. Each post object must include the keys `id`, `title`, `createdAt`, and `tags`, where `tags` is an array of the post's tag objects each exposing at least `id` and `name`.
  - `totalCount`: an integer equal to the total number of posts matching the `tagNames` filter across all pages (i.e., the count BEFORE pagination is applied).
- Ordering must be deterministic: results are ordered first by the requested `sortBy.field` in the requested `sortBy.direction`, and then, as a stable secondary tiebreaker applied after the primary ordering, by `id` in ascending order (always ascending, regardless of `sortBy.direction`).
- Pagination must use offset/limit semantics: skip `(page - 1) * pageSize` matching posts and take at most `pageSize` posts. Requesting a page beyond the available results must return an empty `posts` array while `totalCount` still reflects the full count of matching posts.

