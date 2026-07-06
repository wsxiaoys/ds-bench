import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './root';

function HomeComponent() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Home Page</h1>
      <p>This is the public home page.</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  );
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeComponent,
});
