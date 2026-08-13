import React, { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

function App() {
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      console.log('Submitted values:', value)
      setSubmitSuccess(true)
    },
  })

  return (
    <div className="login-container" style={{ maxWidth: '400px', margin: '60px auto', padding: '30px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow)', background: 'var(--bg)', textAlign: 'left' }}>
      <h2 style={{ textAlign: 'center', marginTop: 0, marginBottom: '24px' }}>Login</h2>
      
      {submitSuccess && (
        <div id="success-message" style={{ color: 'green', backgroundColor: 'rgba(0, 128, 0, 0.1)', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center', border: '1px solid rgba(0, 128, 0, 0.2)' }}>
          Login successful
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <form.Field
            name="email"
            validators={{
              onChange: z.string().min(1, 'Email is required').email('Invalid email address'),
            }}
            children={(field) => (
              <>
                <label htmlFor={field.name} style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Email Address
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text-h)' }}
                />
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <div className="error-message" style={{ color: 'red', fontSize: '14px', marginTop: '6px' }}>
                    {field.state.meta.errors.map((err) => (typeof err === 'object' ? err.message : err)).join(', ')}
                  </div>
                )}
              </>
            )}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <form.Field
            name="password"
            validators={{
              onChange: z.string().min(8, 'Password must be at least 8 characters long'),
            }}
            children={(field) => (
              <>
                <label htmlFor={field.name} style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Password
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '16px', background: 'var(--bg)', color: 'var(--text-h)' }}
                />
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <div className="error-message" style={{ color: 'red', fontSize: '14px', marginTop: '6px' }}>
                    {field.state.meta.errors.map((err) => (typeof err === 'object' ? err.message : err)).join(', ')}
                  </div>
                )}
              </>
            )}
          />
        </div>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.6,
                transition: 'opacity 0.2s'
              }}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          )}
        />
      </form>
    </div>
  )
}

export default App
