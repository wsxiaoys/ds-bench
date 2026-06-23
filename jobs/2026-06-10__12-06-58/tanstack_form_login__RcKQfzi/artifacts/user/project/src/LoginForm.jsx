import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

const emailSchema = z.string().email('Please enter a valid email address')
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export default function LoginForm() {
  const [loginSuccess, setLoginSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      console.log('Submitted:', value)
      setLoginSuccess(true)
    },
  })

  if (loginSuccess) {
    return (
      <div className="container">
        <div className="card success-card">
          <div className="success-icon">✓</div>
          <h2 className="success-title">Login successful</h2>
          <p className="success-message">Welcome back! You have logged in successfully.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setLoginSuccess(false)
              form.reset()
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h1 className="title">Welcome back</h1>
          <p className="subtitle">Sign in to your account</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          noValidate
        >
          {/* Email Field */}
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = emailSchema.safeParse(value)
                if (!result.success) {
                  return result.error.issues[0].message
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="field-group">
                <label htmlFor={field.name} className="label">
                  Email address
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="you@example.com"
                  className={`input ${field.state.meta.errors.length > 0 ? 'input-error' : ''}`}
                  autoComplete="email"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="error-message" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Password Field */}
          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                const result = passwordSchema.safeParse(value)
                if (!result.success) {
                  return result.error.issues[0].message
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="field-group">
                <label htmlFor={field.name} className="label">
                  Password
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`input ${field.state.meta.errors.length > 0 ? 'input-error' : ''}`}
                  autoComplete="current-password"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="error-message" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="button button-primary"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
