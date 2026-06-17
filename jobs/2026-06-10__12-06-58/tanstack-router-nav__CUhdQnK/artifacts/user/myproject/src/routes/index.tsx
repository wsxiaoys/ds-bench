import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="page">
      <h1>Home</h1>
      <p>Welcome to the Home page!</p>
    </div>
  )
}
