import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import './App.css'

const step1Schema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
})

const firstNameSchema = z
  .string()
  .min(2, 'First name must be at least 2 characters')

const lastNameSchema = z
  .string()
  .min(2, 'Last name must be at least 2 characters')

const emailSchema = z.string().email('Please enter a valid email address')

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')

type FormData = {
  firstName: string
  lastName: string
  email: string
  password: string
}

function FieldError({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return <p className="field-error">{errors.join(', ')}</p>
}

function App() {
  const [step, setStep] = useState<1 | 2>(1)
  const [submittedData, setSubmittedData] = useState<FormData | null>(null)

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setSubmittedData(value as FormData)
    },
  })

  const handleNext = async () => {
    // Mark both fields as touched so errors are visible
    form.setFieldMeta('firstName', (prev) => ({ ...prev, isTouched: true }))
    form.setFieldMeta('lastName', (prev) => ({ ...prev, isTouched: true }))

    // Trigger validation for both fields
    await form.validateField('firstName', 'change')
    await form.validateField('lastName', 'change')

    // Use Zod directly to determine if we can proceed
    const result = step1Schema.safeParse({
      firstName: form.state.values.firstName,
      lastName: form.state.values.lastName,
    })

    if (result.success) {
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
          <h2>Registration Successful! 🎉</h2>
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="form-container">
      <h1 className="form-title">Registration</h1>

      <div className="step-indicator">
        <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
        <div className="step-line"></div>
        <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {step === 1 && (
          <div className="step-content">
            <h2>Step 1: User Info</h2>

            <form.Field
              name="firstName"
              validators={{
                onChange: firstNameSchema,
              }}
            >
              {(field) => (
                <div className="field-group">
                  <label htmlFor={field.name}>First Name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter your first name"
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched
                        ? (field.state.meta.errors as string[])
                        : []
                    }
                  />
                </div>
              )}
            </form.Field>

            <form.Field
              name="lastName"
              validators={{
                onChange: lastNameSchema,
              }}
            >
              {(field) => (
                <div className="field-group">
                  <label htmlFor={field.name}>Last Name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter your last name"
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched
                        ? (field.state.meta.errors as string[])
                        : []
                    }
                  />
                </div>
              )}
            </form.Field>

            <div className="button-group">
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h2>Step 2: Account Info</h2>

            <form.Field
              name="email"
              validators={{
                onChange: emailSchema,
              }}
            >
              {(field) => (
                <div className="field-group">
                  <label htmlFor={field.name}>Email</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter your email"
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched
                        ? (field.state.meta.errors as string[])
                        : []
                    }
                  />
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
                <div className="field-group">
                  <label htmlFor={field.name}>Password</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Enter your password"
                  />
                  <FieldError
                    errors={
                      field.state.meta.isTouched
                        ? (field.state.meta.errors as string[])
                        : []
                    }
                  />
                </div>
              )}
            </form.Field>

            <div className="button-group">
              <button type="button" className="btn btn-secondary" onClick={handleBack}>
                ← Back
              </button>
              <form.Subscribe
                selector={(state) => state.isSubmitting}
              >
                {(isSubmitting) => (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                )}
              </form.Subscribe>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default App
