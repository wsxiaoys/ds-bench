import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to the Home Page!</h1>
      <p>This is a type-safe navigation menu application built with TanStack Router and Vite.</p>
    </div>
  )
}
