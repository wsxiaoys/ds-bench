import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>TanStack Start Kanban Board</title>
          <HeadContent />
          <style>{`
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #f3f4f6;
              color: #1f2937;
            }
            * {
              box-sizing: border-box;
            }
          `}</style>
        </head>
        <body>
          <Outlet />
          <Scripts />
        </body>
      </html>
    </QueryClientProvider>
  )
}
