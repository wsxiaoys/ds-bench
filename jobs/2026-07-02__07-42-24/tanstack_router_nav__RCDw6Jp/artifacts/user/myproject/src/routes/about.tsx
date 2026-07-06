import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>About Us</h1>
      <p>We are dedicated to building high-quality, type-safe React applications.</p>
    </div>
  )
}
