import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

export function LoginForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      // Clear any previous success message
      setSuccessMessage(null)
      // Display success message and log values
      setSuccessMessage('Login successful')
      console.log('Successfully submitted:', value)
    },
  })

  return (
    <div className="login-container">
      {successMessage ? (
        <div className="success-banner" role="alert">
          <h2>{successMessage}</h2>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => {
              setSuccessMessage(null)
              form.reset()
            }}
          >
            Go back
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="login-form"
        >
          <h2>Login</h2>
          
          <form.Field
            name="email"
            validators={{
              onChange: z.string().min(1, 'Email is required').email('Invalid email address'),
            }}
          >
            {(field) => (
              <div className="form-group">
                <label htmlFor={field.name}>Email Address</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter your email"
                  className={field.state.meta.errors.length ? 'input-error' : ''}
                />
                {field.state.meta.errors.length ? (
                  <span className="error-text" role="alert">
                    {field.state.meta.errors.map((err: any) => typeof err === 'string' ? err : err.message).join(', ')}
                  </span>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: z.string().min(8, 'Password must be at least 8 characters long'),
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
                  placeholder="Enter your password"
                  className={field.state.meta.errors.length ? 'input-error' : ''}
                />
                {field.state.meta.errors.length ? (
                  <span className="error-text" role="alert">
                    {field.state.meta.errors.map((err: any) => typeof err === 'string' ? err : err.message).join(', ')}
                  </span>
                ) : null}
              </div>
            )}
          </form.Field>

          <button
            type="submit"
            className="btn-submit"
          >
            Login
          </button>
        </form>
      )}
    </div>
  )
}
