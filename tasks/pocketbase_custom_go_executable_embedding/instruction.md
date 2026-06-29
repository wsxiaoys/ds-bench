# Custom Go Executable Embedding PocketBase

## Background
PocketBase can be used as a standalone application, but it can also be imported as a standard Go module, allowing developers to extend it with Go event hooks.

## Requirements
- Initialize a Go module in the project directory `/home/user/myproject`.
- Embed PocketBase (v0.31.0) as a Go library.
- Create a custom `main.go` that initializes the PocketBase application.
- Add a Go event hook (`OnRecordBeforeCreateRequest`) for the `posts` collection.
- The hook must intercept record creation:
  - If the `title` field is empty or missing, return a 400 Bad Request error with the message "Title cannot be empty".
  - If the `title` field is provided, programmatically generate a `slug` field by slugifying the title.
  - Ensure the hook properly propagates execution to the next handler in the chain.
- Build the Go application into an executable named `server` that can serve the application on port `8090` (e.g., using `./server serve --http="0.0.0.0:8090"`).

## Implementation Hints
- Initialize a Go module and fetch the `github.com/pocketbase/pocketbase` dependency (v0.31.0).
- Use `pocketbase.New()` to create the app instance.
- Use `app.OnRecordBeforeCreateRequest("posts").BindFunc(...)` to register the hook.
- Inside the hook, read the title via `e.Record.GetString("title")` and set the slug via `e.Record.Set("slug", core.Slugify(title))`.
- Remember to call `e.Next()` to continue the hook execution chain.
- Build the application using `go build -o server` and run it using `./server serve --http="0.0.0.0:8090"`.

