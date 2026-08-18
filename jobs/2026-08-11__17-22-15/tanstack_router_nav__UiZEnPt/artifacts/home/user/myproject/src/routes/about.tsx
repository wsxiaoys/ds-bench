import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div className="p-2">
      <h1>About Us</h1>
      <p>This is the About page. Here we tell you more about our application.</p>
    </div>
  )
}
