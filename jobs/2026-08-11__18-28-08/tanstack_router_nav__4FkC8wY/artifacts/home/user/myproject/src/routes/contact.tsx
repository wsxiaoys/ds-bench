import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: Contact,
})

function Contact() {
  return (
    <div className="page">
      <h1>Contact Page</h1>
      <p>Get in touch with us on the Contact Page!</p>
    </div>
  )
}
