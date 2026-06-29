# PocketBase: Auto-Compute Word Count and Reading Time (Go Event Hooks)

## Background
You are extending a PocketBase v0.31.0 application written in Go that hosts a small blog backend. A starter project lives at `/home/user/myproject` and already includes:

- A `go.mod` file that pins `github.com/pocketbase/pocketbase v0.31.0`.
- A `main.go` entry point that constructs the PocketBase app and starts it (you must extend it).
- A `migrations/` package that programmatically creates a base collection named `articles` with the following fields:
  - `title` (text, required)
  - `content` (text)
  - `word_count` (number, integer)
  - `reading_time_minutes` (number, integer)

Your job is to plug in PocketBase event hooks so that whenever an `articles` record is created or updated through the REST API, the server automatically derives the `word_count` and `reading_time_minutes` values from the submitted `content` field.

## Requirements
- Implement Go event hooks for the `articles` collection that run on both record create and record update REST requests.
- The hooks must set `word_count` to the number of whitespace-separated words found in the submitted `content` value (an empty or whitespace-only content yields 0 words).
- The hooks must set `reading_time_minutes` to `ceil(word_count / 200)` (so 0 words -> 0 minutes, 1-200 words -> 1 minute, 201-400 words -> 2 minutes, etc.).
- The computed values must overwrite anything the client supplied for `word_count` or `reading_time_minutes`, so clients cannot bypass the calculation.
- The hook chain must continue normally so the record is persisted; if you stop the chain the record will never be saved.
- Provision a superuser with email `admin@example.com` and password `SuperSecret123` using the `superuser upsert` subcommand of the compiled binary, then start the server on `0.0.0.0:8090`.

## Implementation Hints
- Use the PocketBase v0.31 hook API (`BindFunc`) and remember to call `e.Next()` from your handler so the request continues through the middleware chain.
- `OnRecordCreateRequest("articles")` and `OnRecordUpdateRequest("articles")` are the relevant hooks for REST traffic.
- `e.Record.GetString("content")` returns the submitted text; `e.Record.Set(...)` writes the derived fields back onto the record before it is saved.
- The standard library `strings.Fields` plus `math.Ceil` are enough to compute the word count and the rounded-up reading time.
- Build the binary with `go build -o app .` and then run `./app superuser upsert admin@example.com SuperSecret123` to create the admin account before `./app serve --http=0.0.0.0:8090`.

