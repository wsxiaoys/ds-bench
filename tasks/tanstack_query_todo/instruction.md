# TanStack Query Todo List

## Background
Create a basic Todo list application that fetches and creates items using TanStack Query. You will need to implement both a simple backend API and a React frontend.

## Requirements
- Implement a backend API (e.g., using Express) with endpoints to get and create todos.
- Implement a React frontend that uses TanStack Query (`useQuery` and `useMutation`) to interact with the API.
- The frontend must display the list of todos and provide a form to add new ones.
- When a new todo is added, the list must update automatically without a page reload.
- The application (both frontend and API) must be served on port 4821.

## Implementation Hints
- You can use Vite to build the React frontend and serve it statically from your backend server, or use a tool like `ts-node` to run a server that handles both API and SSR/static serving.
- Use `useQuery` to fetch the todos from `/api/todos`.
- Use `useMutation` to post new todos to `/api/todos`. On success, invalidate the query to refetch the updated list.
- Keep the backend state in-memory for simplicity.

## Acceptance Criteria
- Project path: `/home/user/tanstack-query-todo`
- Start command: `npm start`
- Port: 4821
- API Endpoints:
  - `GET /api/todos`: Returns status 200 and a JSON array of todo objects.
    ```json
    [
      {
        "id": number,
        "text": string,
        "completed": boolean
      }
    ]
    ```
  - `POST /api/todos`: Accepts a JSON object and returns status 201 with the created todo object.
    ```json
    // Request
    {
      "text": string
    }
    // Response
    {
      "id": number,
      "text": string,
      "completed": boolean
    }
    ```
- Frontend UI Requirements:
  - The main page must be accessible at `http://localhost:4821/`.
  - The list of todos must be rendered inside a container with `id="todo-list"`. Each todo item should be an `<li>` element containing the todo text.
  - There must be an input field with `id="todo-input"` for entering new todo text.
  - There must be a submit button with `id="todo-submit"` to add the todo.
  - Submitting the form must trigger a TanStack Query mutation and update the list automatically.

