# E-commerce Shopping Cart with TanStack

## Background
Create an e-commerce shopping cart application using TanStack Query for data fetching and TanStack Router for URL-based state management.

## Requirements
- Create a React web application using TanStack Query and TanStack Router (you may use Vite or TanStack Start).
- Display a list of products fetched using TanStack Query (you can use mock data or a mock API function).
- Implement a shopping cart where the cart state (items and their quantities) is stored entirely in the URL search parameters using TanStack Router.
- Users must be able to add products to the cart, remove them, and adjust quantities, with all changes reflecting in the URL.
- The application must run on port 8432.

## Implementation Hints
- Configure your dev server (e.g., Vite) to run on port `8432`.
- Use `useQuery` from `@tanstack/react-query` to fetch the product list.
- Define a route using `@tanstack/react-router` and use its search param API (e.g., `validateSearch`) to parse and serialize the cart state in the URL.
- Use the router's navigation API (`useNavigate` or `Link`) to update the cart state in the URL when a user interacts with the cart.

## Acceptance Criteria
- Project path: /home/user/ecommerce-cart
- Start command: npm run dev
- Port: 8432
- Routes and Features:
  - GET `/`: Displays a list of products. Each product has an "Add to Cart" button.
  - The cart state must be managed via URL search parameters (e.g., `/?cart=...` or `/?items=...`).
  - Clicking "Add to Cart" updates the URL search parameters to include the item without losing other URL state.
  - The page displays the current cart contents and total based on the URL state.
  - Refreshing the page with the cart URL parameters must restore the cart state correctly.

