import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <div>
      <h1>Contact</h1>
      <p>Contact us at example@example.com</p>
    </div>
  )
}
