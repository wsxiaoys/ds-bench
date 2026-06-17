import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="page">
      <h1>About</h1>
      <p>Learn more about us on this About page.</p>
    </div>
  )
}
