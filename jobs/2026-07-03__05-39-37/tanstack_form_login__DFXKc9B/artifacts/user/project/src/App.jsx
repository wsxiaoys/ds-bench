import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')

function App() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      // In a real app you would authenticate against a backend here.
      console.log('Submitted:', value)
      setSubmitted(true)
    },
  })

  return (
    <div className="login-container">
      <h1>Login</h1>

      {submitted ? (
        <p className="success-message">Login successful</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = emailSchema.safeParse(value)
                return result.success ? undefined : result.error.issues[0].message
              },
              onBlur: ({ value }) => {
                const result = emailSchema.safeParse(value)
                return result.success ? undefined : result.error.issues[0].message
              },
            }}
          >
            {(field) => (
              <div className="field">
                <label htmlFor={field.name}>Email</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="error">{field.state.meta.errors[0]}</span>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                const result = passwordSchema.safeParse(value)
                return result.success ? undefined : result.error.issues[0].message
              },
              onBlur: ({ value }) => {
                const result = passwordSchema.safeParse(value)
                return result.success ? undefined : result.error.issues[0].message
              },
            }}
          >
            {(field) => (
              <div className="field">
                <label htmlFor={field.name}>Password</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="error">{field.state.meta.errors[0]}</span>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>
            )}
          </form.Subscribe>
        </form>
      )}
    </div>
  )
}

export default App