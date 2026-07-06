import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

function App() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      console.log('Form submitted with:', value)
      setSubmitted(true)
    },
  })

  if (submitted) {
    return (
      <div className="login-container">
        <h1>Login</h1>
        <div className="success">Login successful</div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <h1>Login</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              const result = loginSchema.shape.email.safeParse(value)
              if (!result.success) {
                return result.error.issues[0]?.message ?? 'Invalid email'
              }
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="form-group">
              <label htmlFor={field.name}>Email</label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {!field.state.meta.isValid && (
                <div className="error">
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              const result = loginSchema.shape.password.safeParse(value)
              if (!result.success) {
                return result.error.issues[0]?.message ?? 'Invalid password'
              }
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="form-group">
              <label htmlFor={field.name}>Password</label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {!field.state.meta.isValid && (
                <div className="error">
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

export default App
