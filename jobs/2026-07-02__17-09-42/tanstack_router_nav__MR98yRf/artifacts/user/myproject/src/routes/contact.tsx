import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <main className="page">
      <h1>Contact</h1>
      <p>Reach us at contact@example.com.</p>
    </main>
  )
}
