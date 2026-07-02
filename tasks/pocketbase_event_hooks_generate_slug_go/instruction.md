# PocketBase Go Event Hook: Programmatically Generate Slug

## Background
You are building a custom Go application that embeds PocketBase as a framework. You need to implement a server-side Go event hook that automatically generates a slug from a post's title before the record is saved to the database.

## Requirements
- The project is located at `/home/user/myproject`.
- Initialize a custom PocketBase application in Go.
- Intercept record creation requests for the `posts` collection.
- If the `title` field is empty, reject the request with a `BadRequestError` and the message "Title cannot be empty".
- If the `title` is provided, programmatically generate a URL-friendly slug from the title and set it to the `slug` field of the record.
- Ensure the hook execution chain is properly propagated so the record is saved.
- The application must build and run on port `8090` (e.g., via `go build -o myapp && ./myapp serve --http="0.0.0.0:8090"`).

## Implementation Hints
- Use `app.OnRecordBeforeCreateRequest("posts").BindFunc(...)` to register the event hook.
- Use `e.Record.GetString("title")` to read the title and `e.Record.Set("slug", ...)` to update the slug.
- Use `core.Slugify(...)` to generate the slug.
- You must call `e.Next()` to continue the hook execution chain. Failing to do so will block the operation.

