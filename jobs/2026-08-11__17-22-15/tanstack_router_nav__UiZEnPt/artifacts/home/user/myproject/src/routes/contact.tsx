import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contact')({
  component: ContactComponent,
})

function ContactComponent() {
  return (
    <div className="p-2">
      <h1>Contact Us</h1>
      <p>Get in touch with us through this type-safe Contact page.</p>
    </div>
  )
}
