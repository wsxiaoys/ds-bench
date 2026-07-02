# E-commerce Shopping Cart with TanStack

## Background
Create an e-commerce shopping cart application using TanStack Query for data fetching and TanStack Router for URL-based state management.

## Requirements
- Create a React web application at `/home/user/ecommerce-cart` using TanStack Query and TanStack Router (you may use Vite or TanStack Start).
- The application must run on port `8432` and be started with `npm run dev`.
- Display a list of products fetched using TanStack Query (you can use mock data or a mock API function). Each product should have an "Add to Cart" button.
- Implement a shopping cart where the cart state (items and their quantities) is stored entirely in the URL search parameters using TanStack Router (e.g., `/?cart=...` or `/?items=...`).
- Users must be able to add products to the cart, remove them, and adjust quantities, with all changes reflecting in the URL.
- The page must display the current cart contents and total based on the URL state, and refreshing the page with the cart URL parameters must restore the cart state correctly.

## Implementation Hints
- Configure your dev server (e.g., Vite) to run on port `8432`.
- Use `useQuery` from `@tanstack/react-query` to fetch the product list.
- Define a route using `@tanstack/react-router` and use its search param API (e.g., `validateSearch`) to parse and serialize the cart state in the URL.
- Use the router's navigation API (`useNavigate` or `Link`) to update the cart state in the URL when a user interacts with the cart, ensuring other URL state is not lost.

