import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div style={{ padding: '10px' }}>
      <h1>Home Page</h1>
    </div>
  )
}
