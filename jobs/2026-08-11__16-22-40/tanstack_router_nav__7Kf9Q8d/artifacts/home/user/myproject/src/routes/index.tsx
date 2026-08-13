import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to our type-safe React application powered by TanStack Router!</p>
    </div>
  )
}
