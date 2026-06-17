import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

function App() {
  const [successMessage, setSuccessMessage] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: ({ value }) => {
      setSuccessMessage('Login successful')
      console.log('Form submitted:', value)
    },
  })

  return (
    <div className="login-container">
      <h1>Login</h1>

      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.Field
          name="email"
          validators={{
            onChange: loginSchema.shape.email,
          }}
        >
          {(field) => (
            <div className="form-field">
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
                <span className="error">
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: loginSchema.shape.password,
          }}
        >
          {(field) => (
            <div className="form-field">
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
                <span className="error">
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <button type="submit" disabled={!canSubmit}>
              Submit
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

export default App
