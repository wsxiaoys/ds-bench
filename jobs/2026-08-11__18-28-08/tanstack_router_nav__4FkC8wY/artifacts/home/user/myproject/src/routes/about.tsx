import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="page">
      <h1>About Page</h1>
      <p>This is the About Page. We build type-safe, active-highlighted navigation menus using TanStack Router.</p>
    </div>
  )
}
