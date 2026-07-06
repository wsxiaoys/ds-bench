import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from './root';
import { useAuth } from '../auth';

function LoginComponent() {
  const auth = useAuth();
  const navigate = useNavigate({ from: '/login' });

  const handleLogin = () => {
    auth.login();
    navigate({ to: '/dashboard' });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Login Page</h1>
      <p>Click the button below to log in.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginComponent,
});
