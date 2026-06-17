import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address')
const passwordSchema = z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters')

function App() {
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: ({ value }) => {
      setSuccess(true)
    },
  })

  return (
    <div className="login-container">
      <h1>Login</h1>
      {success && <div className="success-message">Login successful</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.Field
          name="email"
          validators={{
            onChange: emailSchema,
          }}
        >
          {(field) => (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <div className="error">{field.state.meta.errors[0]}</div>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: passwordSchema,
          }}
        >
          {(field) => (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <div className="error">{field.state.meta.errors[0]}</div>
              )}
            </div>
          )}
        </form.Field>

        <button type="submit">Submit</button>
      </form>
    </div>
  )
}

export default App