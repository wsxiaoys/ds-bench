# Dynamic Slug Blog on Cloudflare D1

## Background
You are building a small blog on top of RedwoodSDK (rwsdk), a server-first React framework for the Cloudflare platform. Blog posts must be persisted in a Cloudflare D1 database and accessed through Drizzle ORM. Individual posts are served through a dynamic slug route, an index page lists the available posts, and requests for posts that do not exist must return a proper 404.

A base RedwoodSDK project has already been scaffolded for you. Your job is to wire up the database, define the schema and migrations, and implement the routes.

## Requirements
- Persist blog posts in a Cloudflare D1 database bound to the worker under the binding name `DB`.
- Access the database through Drizzle ORM (`drizzle-orm/d1`).
- Model posts in a table named `posts` with at least the following columns:
  - `id` — text primary key.
  - `slug` — text, unique, not null (used as the URL segment for a post).
  - `title` — text, not null.
  - `content` — text, not null (the full body of the post).
- Generate and apply a migration so the `posts` table exists in the local D1 database.
- Implement an index route at `/blog` that reads all posts from the database and renders, for each post, a link whose visible text includes the post `title` and whose `href` points to that post's slug route (`/blog/<slug>`).
- Implement a dynamic slug route at `/blog/:slug` that looks up the post with the matching `slug` and renders the full post: its `title` and its `content` must both appear in the HTML.
- When the requested slug does not match any post, the `/blog/:slug` route must respond with HTTP status `404`.
- Routes must return server-rendered JSX/HTML (not raw JSON).

## Implementation Hints
- Routes are declared inside `defineApp` in `src/worker.tsx` using `route` from `rwsdk/router`. Dynamic segments are marked with a colon (`/blog/:slug`) and the value is available on the handler's `params` (e.g. `params.slug`).
- A route handler can return JSX directly; RedwoodSDK renders it to HTML on the server.
- To return a 404 you can either return a `Response` with `{ status: 404 }` or mutate the response status via `requestInfo` / the handler's `RequestInfo` before returning content.
- Configure the D1 binding in `wrangler.jsonc` (`d1_databases`) and set `migrations_dir` so `wrangler d1 migrations apply` can find generated migrations. Create the Drizzle client from `env.DB`.
- Use `drizzle-kit generate` to produce SQL migrations from your schema and `wrangler d1 migrations apply DB --local` to apply them to the local database.
- Remember route matching order: place the index route and the dynamic route so both resolve correctly.

## Runtime & Interface
- Project path: `/home/user/project`
- Start command: `npm run dev`
- Port: `5173`
- HTTP interface the running app must expose:
  - `GET /blog` — HTML page listing every post; each entry links to `/blog/<slug>` and shows the post title.
  - `GET /blog/<slug>` — HTML page for a single post showing its `title` and `content`; returns `404` when no post has that slug.

