import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div>
      <h1>About Us</h1>
      <p>This is the about page. We love building type-safe web applications.</p>
    </div>
  )
}
