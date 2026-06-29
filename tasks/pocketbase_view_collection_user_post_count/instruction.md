# PocketBase view collection: user_post_stats

## Goal
Configure the PocketBase v0.31.0 application at `/home/user/myproject` so that it exposes a read-only **view collection** named `user_post_stats`. The view must aggregate, for every user in the existing `users` (auth) collection, the total number of `posts` that reference the user as their `author` and the timestamp of that user's most recent post.

## Requirements
- The view collection must be named `user_post_stats`.
- Each record in the view must contain the following fields:
  - `id` — a non-empty string that matches the `id` of a record in the built-in `users` collection (one row per user).
  - `user` — the same user id.
  - `email` — the user's email address.
  - `post_count` — an integer `≥ 0` equal to the actual number of `posts` whose `author` field references that user.
  - `last_post_at` — the most recent `posts.created` timestamp (PocketBase RFC3339-style string, e.g. `"2024-11-10 18:45:27.123Z"`) for that user, or an empty string `""` when the user has no posts.
- The view collection must support standard PocketBase sorting (e.g., sorting by `-post_count` to order results by descending post count) and filtering (e.g., filtering with `post_count > 0`).

