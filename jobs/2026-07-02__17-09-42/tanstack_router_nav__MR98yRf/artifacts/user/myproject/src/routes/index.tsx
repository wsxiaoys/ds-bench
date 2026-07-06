import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <main className="page">
      <h1>Home</h1>
      <p>Welcome to the TanStack Router demo. Navigate using the menu above.</p>
    </main>
  )
}
