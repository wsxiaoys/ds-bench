import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: Contact,
})

function Contact() {
  return (
    <div className="page">
      <h1>Contact</h1>
      <p>Get in touch with us on this Contact page.</p>
    </div>
  )
}
