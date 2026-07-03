import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div>
      <h1>Home</h1>
      <p>This is a public page.</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  )
}