import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

function App() {
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setSuccess(true)
      console.log('Submitted values:', value)
    },
  })

  return (
    <div className="login-container" style={{ maxWidth: '400px', margin: '40px REDACTED', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Login Form</h2>
      
      {success && (
        <div className="success-message" style={{ backgroundColor: '#d4edda', color: '#155724', padding: '12px', borderRadius: '4px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
          Login successful
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <form.Field
          name="email"
          validators={{
            onChange: z.string().min(1, 'Email is required').email('Invalid email address'),
          }}
        >
          {(field) => (
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label htmlFor={field.name} style={{ fontWeight: '500', color: 'var(--text-h)' }}>Email Address</label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  fontSize: '16px',
                  background: 'var(--bg)',
                  color: 'var(--text-h)'
                }}
              />
              {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                <div className="error-message" style={{ color: '#dc3545', fontSize: '14px', marginTop: '2px' }}>
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
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
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label htmlFor={field.name} style={{ fontWeight: '500', color: 'var(--text-h)' }}>Password</label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  fontSize: '16px',
                  background: 'var(--bg)',
                  color: 'var(--text-h)'
                }}
              />
              {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                <div className="error-message" style={{ color: '#dc3545', fontSize: '14px', marginTop: '2px' }}>
                  {field.state.meta.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <button
          type="submit"
          style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--accent, #aa3bff)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          Submit
        </button>
      </form>
    </div>
  )
}

export default App
