import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <div>
      <h1>Contact Page</h1>
      <p>This is the Contact page of our application.</p>
      <p>If you have any questions or feedback, feel free to reach out to us!</p>
    </div>
  )
}
