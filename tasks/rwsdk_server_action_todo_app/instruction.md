# RedwoodSDK: Server-Action Todo List

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Build a small Todo list UI on the `/todos` route. The UI is rendered as React Server Components on `/todos`, and mutations use `serverAction` from `rwsdk/worker` (HTTP method POST). Persist todos in a module-level array on the worker.

## Requirements
- Implement `GET /todos` which renders a server component listing all todos. Each todo's text appears inside an element with attribute `data-testid="todo-item"`. Below the list, render a `<form>` with an input named `title` and a `<button type="submit">Add Todo</button>`. The form must call a `serverAction` named `addTodo` (it must wrap the underlying mutation with `serverAction(...)` from `rwsdk/worker`).
- Implement `addTodo` so that when posted with the form data (`title=<string>`), the new todo is appended to the in-memory list (id is a fresh `crypto.randomUUID()`), then the page is rehydrated and the new todo appears in the list.
- Each todo row must include a `<button>` (or `<form>`) labelled `Delete` that calls a `serverAction` to remove that todo by id, again re-rendering the list.
- Implement a small API endpoint `GET /todos.json` returning JSON `{"todos": [{"id", "title"}, ...]}` (this is what the verifier uses to sanity-check state without scraping HTML).
- Implement `POST /todos.reset` returning body `reset` after clearing the in-memory list (used by the verifier to start from a clean slate).

## Acceptance Criteria
- Project path: /home/user/myapp
- Start command: npm run dev -- --host 0.0.0.0 --port 5173
- Port: 5173
- `GET /todos.json` → JSON `{"todos": [...]}` reflecting current state.
- `POST /todos.reset` → body `reset`; afterwards `/todos.json` returns `{"todos": []}`.
- `GET /todos` renders HTML containing the visible text `Add Todo` (the button label) and an `<input` whose `name="title"`.
- Browser-driven verification: after navigating to http://localhost:5173/todos and submitting the form with `Buy milk`, the new todo appears in the list. After clicking the matching `Delete` button, the todo disappears.

