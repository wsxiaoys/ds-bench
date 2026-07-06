import * as React from 'react';
import { createRoute, redirect, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './root';
import { useAuth, type AuthRouterContext } from '../auth';

function DashboardComponent() {
  const auth = useAuth();
  const navigate = useNavigate({ from: '/dashboard' });

  const handleLogout = () => {
    auth.logout();
    navigate({ to: '/login' });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Welcome to Dashboard</h1>
      <p>This page is protected and only accessible to authenticated users.</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: ({ context }) => {
    const authContext = context as AuthRouterContext | undefined;
    if (!authContext?.auth?.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardComponent,
});
