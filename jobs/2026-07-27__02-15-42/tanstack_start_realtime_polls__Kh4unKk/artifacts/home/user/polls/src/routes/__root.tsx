import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { Outlet, ScrollRestoration } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createRootRoute({
  meta: () => [
    {
      charSet: 'utf-8',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
    {
      title: 'Real-Time Polling App',
    },
  ],
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style>{`
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            color: #111827;
          }
          header {
            background-color: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          header h1 {
            margin: 0;
            font-size: 1.5rem;
          }
          header h1 a {
            color: #111827;
            text-decoration: none;
          }
          main {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            margin-bottom: 1.5rem;
          }
          .btn {
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            cursor: pointer;
            font-weight: 500;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .btn-secondary {
            background-color: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
          }
          .btn-secondary:hover {
            background-color: #e5e7eb;
          }
          .error {
            color: #dc2626;
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            padding: 0.75rem;
            border-radius: 0.375rem;
            margin-bottom: 1rem;
          }
        `}</style>
      </head>
      <body>
        <header>
          <h1><a href="/">⚡ Real-Time Polls</a></h1>
        </header>
        <main>
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
