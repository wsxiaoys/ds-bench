import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div>
      <h1>About</h1>
      <p>Learn more about us on this page.</p>
    </div>
  )
}
