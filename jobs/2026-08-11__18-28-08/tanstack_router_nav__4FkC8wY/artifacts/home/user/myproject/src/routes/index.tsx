import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="page">
      <h1>Home Page</h1>
      <p>Welcome to the Home Page of our type-safe navigation menu app!</p>
    </div>
  )
}
