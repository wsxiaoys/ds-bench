import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

function App() {
  const [successMessage, setSuccessMessage] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: ({ value }) => {
      console.log('Submitted values:', value)
      setSuccessMessage('Login successful')
    },
  })

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--code-bg)', textAlign: 'left' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Login</h2>
      
      {successMessage && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', borderRadius: '4px', textAlign: 'center' }}>
          {successMessage}
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
            onChange: z.string().min(1, "Email is required").email("Invalid email address"),
          }}
        >
          {(field) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor={field.name} style={{ fontWeight: 'bold' }}>Email</label>
              <input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '16px' }}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-message" style={{ color: 'red', fontSize: '14px' }}>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: z.string().min(8, "Password must be at least 8 characters long"),
          }}
        >
          {(field) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor={field.name} style={{ fontWeight: 'bold' }}>Password</label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '16px' }}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-message" style={{ color: 'red', fontSize: '14px' }}>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.6,
                marginTop: '8px'
              }}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}

export default App
