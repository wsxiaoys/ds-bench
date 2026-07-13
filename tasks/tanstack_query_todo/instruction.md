# TanStack Query Todo List

## Background
Create a basic Todo list application that fetches and creates items using TanStack Query. You will need to implement both a simple backend API and a React frontend.

## Requirements
- The project is located at `/home/user/tanstack-query-todo`.
- The application must be started using the command `npm start`.
- The application (both frontend and API) must be served on port 4821.
- Implement a backend API with the following endpoints:
  - `GET /api/todos`: Returns status 200 and a JSON array of todo objects:
    ```json
    [
      {
        "id": number,
        "text": string,
        "completed": boolean
      }
    ]
    ```
  - `POST /api/todos`: Accepts a JSON object of the form `{ "text": string }` and returns status 201 with the created todo object:
    ```json
    {
      "id": number,
      "text": string,
      "completed": boolean
    }
    ```
- Implement a React frontend that uses TanStack Query (`useQuery` and `useMutation`) to interact with the API.
  - The main page must be accessible at `http://127.0.0.1:4821/`.
  - The list of todos must be rendered inside a container with `id="todo-list"`. Each todo item should be an `<li>` element containing the todo text.
  - There must be an input field with `id="todo-input"` for entering new todo text.
  - There must be a submit button with `id="todo-submit"` to add the todo.
  - Submitting the form must trigger a TanStack Query mutation and update the list automatically without a page reload.

## Implementation Hints
- You can use Vite to build the React frontend and serve it statically from your backend server, or use a tool like `ts-node` to run a server that handles both API and SSR/static serving.
- Use `useQuery` to fetch the todos from `/api/todos`.
- Use `useMutation` to post new todos to `/api/todos`. On success, invalidate the query to refetch the updated list.
- Keep the backend state in-memory for simplicity.

