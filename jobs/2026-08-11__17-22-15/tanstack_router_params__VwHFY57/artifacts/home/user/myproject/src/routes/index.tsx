import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h3>Home Page</h3>
    </div>
  )
}
