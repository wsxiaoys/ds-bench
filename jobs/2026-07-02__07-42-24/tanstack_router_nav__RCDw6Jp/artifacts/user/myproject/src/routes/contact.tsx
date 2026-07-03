import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Contact Us</h1>
      <p>Feel free to reach out to us at contact@example.com.</p>
    </div>
  )
}
