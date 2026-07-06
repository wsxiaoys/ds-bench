import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <section className="page">
      <h1>Home</h1>
      <p>
        Welcome to the home page. This is a type-safe navigation demo built with
        TanStack Router.
      </p>
    </section>
  )
}