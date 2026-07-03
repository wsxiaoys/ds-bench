import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Index route - the main shopping page.
// The cart state lives in the URL search param `cart` (e.g. ?cart=1:2,2:3).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
  validateSearch: (search: Record<string, unknown>) => {
    // Accept the raw cart string from the URL and forward it to the component.
    // The component decodes it via `decodeCart` so it is robust to malformed input.
    const rawCart = search.cart;
    if (typeof rawCart === 'string' && rawCart.length > 0) {
      return { cart: rawCart };
    }
    // No cart present: use undefined so the param is omitted from the URL.
    return { cart: undefined };
  },
});

// Attach the index route as a child of the root route
const routeTree = rootRoute.addChildren([indexRoute]);

// Create the router
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router for type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}