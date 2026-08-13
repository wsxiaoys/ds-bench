import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <div>
      <h1>Contact Us</h1>
      <p>Get in touch with us at contact@example.com or find us on social media.</p>
    </div>
  )
}
