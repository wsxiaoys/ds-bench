import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'
import './App.css'

const userInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
})

const accountInfoSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const fullSchema = userInfoSchema.merge(accountInfoSchema)

type FormData = z.infer<typeof fullSchema>

// Helper: use the zodValidator adapter with a schema
const zodValidate = <T,>(schema: z.ZodType<T>) => {
  const adapter = zodValidator()()
  return (props: { value: T; fieldApi: unknown }): unknown => {
    return adapter.validate(
      { value: props.value, validationSource: 'field' as const },
      schema,
    )
  }
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
    } as FormData,
    onSubmit: async ({ value }) => {
      setSubmittedData(value)
    },
  })

  const handleNext = async () => {
    const result = userInfoSchema.safeParse(form.state.values)
    if (result.success) {
      setStep(2)
    } else {
      await form.validateAllFields('change')
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  if (submittedData) {
    return (
      <div className="app">
        <h1>Registration Successful!</h1>
        <div id="success-message" data-testid="success-message">
          <p>
            <strong>First Name:</strong> {submittedData.firstName}
          </p>
          <p>
            <strong>Last Name:</strong> {submittedData.lastName}
          </p>
          <p>
            <strong>Email:</strong> {submittedData.email}
          </p>
          <p>
            <strong>Password:</strong> {submittedData.password}
          </p>
        </div>
        <pre id="success-data" style={{ display: 'none' }}>
          {JSON.stringify(submittedData)}
        </pre>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>Multi-step Registration Form</h1>
      <p>Step {step} of 2</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {step === 1 && (
          <div data-testid="step-1">
            <h2>User Info</h2>
            <form.Field
              name="firstName"
              validators={{
                onChange: zodValidate(
                  z.string().min(2, 'First name must be at least 2 characters'),
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>First Name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="error" data-testid={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? '')}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field
              name="lastName"
              validators={{
                onChange: zodValidate(
                  z.string().min(2, 'Last name must be at least 2 characters'),
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Last Name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="error" data-testid={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? '')}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            <div className="actions">
              <button type="button" onClick={handleNext} data-testid="next-button">
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="step-2">
            <h2>Account Info</h2>
            <form.Field
              name="email"
              validators={{
                onChange: zodValidate(z.string().email('Invalid email address')),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Email</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="error" data-testid={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? '')}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field
              name="password"
              validators={{
                onChange: zodValidate(
                  z.string().min(6, 'Password must be at least 6 characters'),
                ),
              }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Password</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="error" data-testid={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? '')}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            <div className="actions">
              <button type="button" onClick={handleBack} data-testid="back-button">
                Back
              </button>
              <button type="submit" data-testid="submit-button">
                Submit
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default App
