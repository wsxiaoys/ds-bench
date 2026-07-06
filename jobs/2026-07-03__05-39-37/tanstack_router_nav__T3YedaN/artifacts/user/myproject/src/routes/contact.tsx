import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <section className="page">
      <h1>Contact</h1>
      <p>
        You can reach us at{' '}
        <a href="mailto:hello@example.com">hello@example.com</a>.
      </p>
    </section>
  )
}