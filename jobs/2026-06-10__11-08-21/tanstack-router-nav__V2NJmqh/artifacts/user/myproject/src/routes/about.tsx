import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div>
      <h1>About Page</h1>
      <p>This is the About page of our application.</p>
      <p>TanStack Router is a fully type-safe router for React, providing autocomplete and compile-time checks for all your routes, search params, and links.</p>
    </div>
  )
}
