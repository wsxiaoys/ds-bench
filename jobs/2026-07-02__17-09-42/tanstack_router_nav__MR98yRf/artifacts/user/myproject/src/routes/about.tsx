import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <main className="page">
      <h1>About</h1>
      <p>
        This app demonstrates TanStack Router with file-based routes and a
        type-safe navigation menu.
      </p>
    </main>
  )
}
