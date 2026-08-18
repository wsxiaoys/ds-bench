import { useState } from 'react'
import { useForm, Field } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

function App() {
  const [successMessage, setSuccessMessage] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      console.log('Form submitted successfully with values:', value)
      setSuccessMessage('Login successful')
    },
  })

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Login</h2>
        
        {successMessage && (
          <div className="success-message" role="alert">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <Field
            form={form}
            name="email"
            validators={{
              onChange: z
                .string()
                .min(1, 'Email must be a valid, non-empty email address')
                .email('Email must be a valid, non-empty email address'),
            }}
          >
            {(field) => (
              <div className="form-group">
                <label htmlFor={field.name}>Email</label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSuccessMessage('') // Clear success message on typing
                    field.handleChange(e.target.value)
                  }}
                  type="email"
                  placeholder="Enter your email"
                />
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <div className="error-message">
                    {field.state.meta.errors.join(', ')}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field
            form={form}
            name="password"
            validators={{
              onChange: z
                .string()
                .min(8, 'Password must be at least 8 characters long'),
            }}
          >
            {(field) => (
              <div className="form-group">
                <label htmlFor={field.name}>Password</label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    setSuccessMessage('') // Clear success message on typing
                    field.handleChange(e.target.value)
                  }}
                  type="password"
                  placeholder="Enter your password"
                />
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <div className="error-message">
                    {field.state.meta.errors.join(', ')}
                  </div>
                )}
              </div>
            )}
          </Field>

          <button type="submit" className="submit-btn">
            Submit
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
