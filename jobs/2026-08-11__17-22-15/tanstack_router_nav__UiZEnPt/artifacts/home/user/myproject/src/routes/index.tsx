import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div className="p-2">
      <h1>Welcome Home!</h1>
      <p>This is the Home page of our type-safe navigation application.</p>
    </div>
  )
}
