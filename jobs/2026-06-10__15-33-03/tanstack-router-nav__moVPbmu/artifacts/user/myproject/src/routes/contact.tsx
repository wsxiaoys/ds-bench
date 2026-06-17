import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

function ContactPage() {
  return (
    <div>
      <h1>Contact</h1>
      <p>This is the Contact page.</p>
    </div>
  )
}