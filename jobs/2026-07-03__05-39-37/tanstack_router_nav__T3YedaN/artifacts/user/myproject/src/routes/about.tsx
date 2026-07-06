import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <section className="page">
      <h1>About</h1>
      <p>
        This page demonstrates file-based routing with TanStack Router. Each
        route is a separate file under <code>src/routes</code>.
      </p>
    </section>
  )
}