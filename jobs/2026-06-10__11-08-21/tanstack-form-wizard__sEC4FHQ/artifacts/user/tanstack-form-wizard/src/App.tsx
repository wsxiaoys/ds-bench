import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

function App() {
  const [step, setStep] = useState(1)
  const [submittedData, setSubmittedData] = useState<any>(null)

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setSubmittedData(value)
    },
  })

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault()
    // Trigger validation for Step 1 fields
    await form.validateField('firstName', 'change')
    await form.validateField('lastName', 'change')

    // Mark Step 1 fields as touched to display errors
    form.setFieldMeta('firstName', (meta) => ({ ...meta, isTouched: true }))
    form.setFieldMeta('lastName', (meta) => ({ ...meta, isTouched: true }))

    const firstNameErrors = form.getFieldMeta('firstName')?.errors || []
    const lastNameErrors = form.getFieldMeta('lastName')?.errors || []

    const firstNameValue = form.getFieldValue('firstName')
    const lastNameValue = form.getFieldValue('lastName')

    const hasErrors = firstNameErrors.some(Boolean) || lastNameErrors.some(Boolean)
    const hasValues = firstNameValue.trim().length >= 2 && lastNameValue.trim().length >= 2

    if (!hasErrors && hasValues) {
      setStep(2)
    }
  }

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault()
    setStep(1)
  }

  return (
    <div className="form-wizard-container">
      <h1>Multi-Step Registration</h1>

      {submittedData ? (
        <div id="success-message" className="success-card">
          <h2>Registration Successful!</h2>
          <p>Thank you for registering. Below are your details:</p>
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
          <button
            onClick={() => {
              setSubmittedData(null)
              form.reset()
              setStep(1)
            }}
            className="btn btn-primary"
          >
            Register Another Account
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="form-card"
        >
          <div className="step-indicator">
            <span className={`step-badge ${step === 1 ? 'active' : ''}`}>Step 1: User Info</span>
            <span className="step-connector"></span>
            <span className={`step-badge ${step === 2 ? 'active' : ''}`}>Step 2: Account Info</span>
          </div>

          {/* Step 1: User Info */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <form.Field
              name="firstName"
              validators={{
                onChange: z.string().min(2, 'First name must be at least 2 characters'),
              }}
            >
              {(field) => (
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Enter first name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={field.state.meta.errors.length > 0 && field.state.meta.isTouched ? 'input-error' : ''}
                  />
                  {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                    <span className="error-message" role="alert">
                      {field.state.meta.errors.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="lastName"
              validators={{
                onChange: z.string().min(2, 'Last name must be at least 2 characters'),
              }}
            >
              {(field) => (
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Enter last name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={field.state.meta.errors.length > 0 && field.state.meta.isTouched ? 'input-error' : ''}
                  />
                  {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                    <span className="error-message" role="alert">
                      {field.state.meta.errors.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            <div className="form-actions">
              <button type="button" onClick={handleNext} className="btn btn-primary">
                Next
              </button>
            </div>
          </div>

          {/* Step 2: Account Info */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            <form.Field
              name="email"
              validators={{
                onChange: z.string().email('Invalid email address'),
              }}
            >
              {(field) => (
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={field.state.meta.errors.length > 0 && field.state.meta.isTouched ? 'input-error' : ''}
                  />
                  {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                    <span className="error-message" role="alert">
                      {field.state.meta.errors.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: z.string().min(6, 'Password must be at least 6 characters'),
              }}
            >
              {(field) => (
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={field.state.meta.errors.length > 0 && field.state.meta.isTouched ? 'input-error' : ''}
                  />
                  {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                    <span className="error-message" role="alert">
                      {field.state.meta.errors.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            <div className="form-actions">
              <button type="button" onClick={handleBack} className="btn btn-secondary">
                Back
              </button>
              <form.Subscribe
                selector={(state) => [state.isSubmitting]}
              >
                {([isSubmitting]) => (
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                )}
              </form.Subscribe>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

export default App
