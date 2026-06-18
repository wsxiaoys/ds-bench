import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './RegistrationForm.css'

interface FormData {
  firstName: string
  lastName: string
  email: string
  password: string
}

export default function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [submittedData, setSubmittedData] = useState<FormData | null>(null)

  const form = useForm<FormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    onSubmit: ({ value }) => {
      setSubmittedData(value)
    },
  })

  const handleNext = async () => {
    // Validate step 1 fields
    const firstNameErrors = await form.validateField('firstName', 'change')
    const lastNameErrors = await form.validateField('lastName', 'change')

    const allErrors = [...firstNameErrors, ...lastNameErrors]

    if (allErrors.length === 0) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  if (submittedData) {
    return (
      <div className="form-container">
        <div id="success-message" className="success-message">
          <h2>Registration Successful!</h2>
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="form-container">
      <h1>Registration</h1>

      <div className="step-indicator">
        <span className={`step ${step === 1 ? 'active' : ''}`}>
          Step 1: User Info
        </span>
        <span className="step-divider" />
        <span className={`step ${step === 2 ? 'active' : ''}`}>
          Step 2: Account Info
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (step === 2) {
            form.handleSubmit()
          }
        }}
      >
        {step === 1 && (
          <div className="step-content">
            <form.Field
              name="firstName"
              validators={{
                onChange: z.string().min(
                  2,
                  'First name must be at least 2 characters',
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
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
              name="lastName"
              validators={{
                onChange: z.string().min(
                  2,
                  'Last name must be at least 2 characters',
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
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

            <div className="button-group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <form.Field
              name="email"
              validators={{
                onChange: z.string().email('Please enter a valid email address'),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
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
                onChange: z.string().min(
                  6,
                  'Password must be at least 6 characters',
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
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

            <div className="button-group">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
              >
                Back
              </button>
              <button type="submit" className="btn btn-primary">
                Submit
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
