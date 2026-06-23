import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div>
      <h1>Home</h1>
      <p>Welcome! Navigate to the search page.</p>
    </div>
  )
}