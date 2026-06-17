import React, { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

export default function App() {
  const [step, setStep] = useState(0)
  const [successData, setSuccessData] = useState<any>(null)

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      setSuccessData(value)
    }
  })

  const handleNext = async () => {
    const fieldsToValidate = step === 0 ? ['firstName', 'lastName'] as const : ['email', 'password'] as const;
    
    let hasErrors = false;
    for (const field of fieldsToValidate) {
      const errors = await form.validateField(field, 'change');
      if (errors && errors.length > 0) {
        hasErrors = true;
      }
    }

    if (!hasErrors) {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => {
    setStep(s => s - 1)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Registration</h1>
      {successData ? (
        <div id="success-message">
          <pre>{JSON.stringify(successData, null, 2)}</pre>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          {step === 0 && (
            <div>
              <h2>Step 1</h2>
              <form.Field
                name="firstName"
                validators={{
                  onChange: z.string().min(2, 'Min 2 characters')
                }}
              >
                {(field) => (
                  <div>
                    <label>First Name</label>
                    <input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors ? (
                      <em style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="lastName"
                validators={{
                  onChange: z.string().min(2, 'Min 2 characters')
                }}
              >
                {(field) => (
                  <div>
                    <label>Last Name</label>
                    <input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors ? (
                      <em style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <button type="button" onClick={handleNext}>Next</button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2>Step 2</h2>
              <form.Field
                name="email"
                validators={{
                  onChange: z.string().email('Invalid email')
                }}
              >
                {(field) => (
                  <div>
                    <label>Email</label>
                    <input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors ? (
                      <em style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="password"
                validators={{
                  onChange: z.string().min(6, 'Min 6 characters')
                }}
              >
                {(field) => (
                  <div>
                    <label>Password</label>
                    <input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors ? (
                      <em style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <button type="button" onClick={handleBack}>Back</button>
              <button type="submit">Submit</button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
