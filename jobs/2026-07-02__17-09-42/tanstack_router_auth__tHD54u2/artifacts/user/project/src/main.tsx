import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthProvider, useAuth, type AuthRouterContext } from './auth';
import { rootRoute } from './routes/root';
import { homeRoute } from './routes/home';
import { loginRoute } from './routes/login';
import { dashboardRoute } from './routes/dashboard';

const routeTree = rootRoute.addChildren([homeRoute, loginRoute, dashboardRoute]);

const router = createRouter({
  routeTree,
  context: {
    auth: {
      isAuthenticated: false,
      login: () => {},
      logout: () => {},
    },
  } as AuthRouterContext,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

const rootEl = document.getElementById('root')!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
