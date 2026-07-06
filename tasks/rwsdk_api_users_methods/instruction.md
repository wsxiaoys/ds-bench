# RedwoodSDK: Rerunnable In-Memory REST Users API

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Build a small JSON REST CRUD surface for users persisted in memory inside the worker module. All routes return JSON.

## Requirements
Implement the following endpoints under `/api/users`. Persist state in a module-level `Map<string, User>` (where `User` is `{ id: string; name: string; email: string }`). Generate IDs server-side (e.g. `crypto.randomUUID()`).

All endpoints must handle JSON payloads and return JSON responses with `Content-Type: application/json`.

- **GET `/api/users`**: Returns a status code of `200` with the body `{"users": [...]}` containing an array of all users sorted by insertion order. If there are no users, return an empty array.
- **POST `/api/users`**: Accepts a JSON body containing `{name, email}`. Returns a status code of `201` with the created user object `{id, name, email}` containing the newly generated ID.
  - If `name` or `email` is missing, or is not a string, return a status code of `400` with the body `{"error": "invalid payload"}`.
- **GET `/api/users/:id`**: Returns a status code of `200` with the user object if the user is found. If the user does not exist, return a status code of `404` with the body `{"error": "not found"}`.
- **PUT `/api/users/:id`**: Accepts a JSON body containing optional `{name?, email?}` fields. Updates the corresponding user and returns a status code of `200` with the updated user object. If the user does not exist, return a status code of `404`.
- **DELETE `/api/users/:id`**: Deletes the user with the given ID. Returns a status code of `204` with an empty body if the user is found and successfully deleted. If the user does not exist, return a status code of `404` with the body `{"error": "not found"}`.

