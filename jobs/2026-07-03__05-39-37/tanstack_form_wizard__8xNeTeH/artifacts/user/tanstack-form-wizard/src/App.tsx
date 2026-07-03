import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import type { ZodTypeAny } from 'zod'
import { z } from 'zod'
import './App.css'

/**
 * A single instance of the Zod validator adapter from `@tanstack/zod-form-adapter`.
 *
 * `zodValidator()` returns the validator factory and calling it once more yields
 * the actual validator object exposing `validate` / `validateAsync`. We reuse this
 * instance for every field so we don't recreate it on each keystroke.
 */
const zodAdapter = zodValidator()()

/**
 * Zod schemas describing the validation rules for each field.
 */
const firstNameSchema = z
  .string()
  .min(2, 'First name must be at least 2 characters')
const lastNameSchema = z
  .string()
  .min(2, 'Last name must be at least 2 characters')
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')

/**
 * Build an `onChange` field validator that runs a Zod schema through the
 * `@tanstack/zod-form-adapter`. The adapter calls `schema.safeParse(value)`
 * internally and turns any issues into a single error string.
 */
function withZod(schema: ZodTypeAny) {
  return ({ value }: { value: unknown }) =>
    zodAdapter.validate({ value, validationSource: 'field' }, schema)
}

type RegistrationData = {
  firstName: string
  lastName: string
  email: string
  password: string
}

function App() {
  const [step, setStep] = useState<1 | 2>(1)
  const [submittedData, setSubmittedData] = useState<RegistrationData | null>(
    null,
  )

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    } as RegistrationData,
    onSubmit: ({ value }) => {
      setSubmittedData(value)
    },
  })

  // Validate the Step 1 fields before allowing the user to proceed.
  const handleNext = async () => {
    const [firstNameErrors, lastNameErrors] = await Promise.all([
      form.validateField('firstName', 'change'),
      form.validateField('lastName', 'change'),
    ])

    const hasErrors =
      (firstNameErrors as unknown[]).length > 0 ||
      (lastNameErrors as unknown[]).length > 0

    if (!hasErrors) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    void form.handleSubmit()
  }

  if (submittedData) {
    return (
      <section id="wizard">
        <div id="success-message" className="success-card">
          <h1>Registration successful!</h1>
          <p>Your account has been created with the following details:</p>
          <dl className="submitted-data">
            <div>
              <dt>First name</dt>
              <dd>{submittedData.firstName}</dd>
            </div>
            <div>
              <dt>Last name</dt>
              <dd>{submittedData.lastName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{submittedData.email}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>{submittedData.password}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="wizard-btn"
            onClick={() => {
              form.reset()
              setSubmittedData(null)
              setStep(1)
            }}
          >
            Register another account
          </button>
        </div>
      </section>
    )
  }

  return (
    <section id="wizard">
      <h1>Create your account</h1>

      <ol className="stepper">
        <li className={step === 1 ? 'active' : ''}>
          <span className="step-number">1</span>
          <span className="step-label">User info</span>
        </li>
        <li className={step === 2 ? 'active' : ''}>
          <span className="step-number">2</span>
          <span className="step-label">Account info</span>
        </li>
      </ol>

      <form className="registration-form" onSubmit={handleSubmit}>
        {step === 1 && (
          <fieldset className="form-step">
            <legend>Step 1 — User info</legend>

            <form.Field
              name="firstName"
              validators={{ onChange: withZod(firstNameSchema) }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>First name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    placeholder="Jane"
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <em className="field-error">
                      {field.state.meta.errors.join(', ')}
                    </em>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="lastName"
              validators={{ onChange: withZod(lastNameSchema) }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Last name</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    placeholder="Doe"
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <em className="field-error">
                      {field.state.meta.errors.join(', ')}
                    </em>
                  )}
                </div>
              )}
            </form.Field>

            <div className="wizard-actions">
              <button
                type="button"
                className="wizard-btn primary"
                onClick={() => void handleNext()}
              >
                Next
              </button>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="form-step">
            <legend>Step 2 — Account info</legend>

            <form.Field
              name="email"
              validators={{ onChange: withZod(emailSchema) }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Email</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    placeholder="jane@example.com"
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <em className="field-error">
                      {field.state.meta.errors.join(', ')}
                    </em>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{ onChange: withZod(passwordSchema) }}
            >
              {(field) => (
                <div className="field">
                  <label htmlFor={field.name}>Password</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    placeholder="At least 6 characters"
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <em className="field-error">
                      {field.state.meta.errors.join(', ')}
                    </em>
                  )}
                </div>
              )}
            </form.Field>

            <div className="wizard-actions">
              <button
                type="button"
                className="wizard-btn"
                onClick={handleBack}
              >
                Back
              </button>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {(state) => (
                  <button
                    type="submit"
                    className="wizard-btn primary"
                    disabled={!state.canSubmit || state.isSubmitting}
                  >
                    {state.isSubmitting ? 'Submitting…' : 'Submit'}
                  </button>
                )}
              </form.Subscribe>
            </div>
          </fieldset>
        )}
      </form>
    </section>
  )
}

export default App