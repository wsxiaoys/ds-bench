import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to our type-safe React application built with Vite and TanStack Router!</p>
      <p>Use the navigation menu above to explore different pages. Notice how the active page link is automatically highlighted with a custom CSS class.</p>
    </div>
  )
}
