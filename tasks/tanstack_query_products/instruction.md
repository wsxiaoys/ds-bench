# Fetch and Display Products with TanStack Query

## Background
TanStack Query (formerly React Query) is a powerful asynchronous state management library. In this task, you will create a simple React application that uses TanStack Query to fetch and display a list of products.

## Requirements
- Initialize a React project (e.g., using Vite with React and TypeScript) in the `/home/user/tanstack-query-products` directory.
- Install `@tanstack/react-query`.
- Configure the `QueryClient` and wrap your application with `QueryClientProvider`.
- Create a mock fetch function that returns a promise resolving to the following list of products after a short delay (e.g., 500ms):
  ```json
  [
    { "id": 1, "name": "Laptop", "price": 999 },
    { "id": 2, "name": "Phone", "price": 599 }
  ]
  ```
- Use the `useQuery` hook to fetch these products.
- While the data is loading, display a "Loading..." message.
- Once the data is loaded, render the products in an unordered list (`<ul>`). Each list item (`<li>`) should display the product name and price (e.g., "Laptop - $999").
- Configure the development server to run on the specified port.

## Implementation Hints
- You can use Vite to quickly scaffold the React project (`npm create vite@latest . -- --template react-ts`).
- Ensure the development server respects the port argument passed to the start command.
- Set up the `QueryClientProvider` at the root of your component tree (e.g., in `main.tsx` or `App.tsx`).
- Use `useQuery` with a `queryKey` and a `queryFn` that calls your mock fetch function.

## Acceptance Criteria
- Project path: /home/user/tanstack-query-products
- Start command: npm run dev -- --port <port>
- The app must serve a web page that initially shows "Loading..." and then displays the product list.
- The product list must contain "Laptop - $999" and "Phone - $599".

