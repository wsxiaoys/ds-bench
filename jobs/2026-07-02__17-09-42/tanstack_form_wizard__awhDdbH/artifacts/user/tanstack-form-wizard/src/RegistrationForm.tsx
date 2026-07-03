import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'
import './RegistrationForm.css'

// Zod schemas for each field
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

// Full registration schema (used for the form-level validator)
const registrationSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  password: passwordSchema,
})

type RegistrationData = z.infer<typeof registrationSchema>

function RegistrationForm() {
  const [step, setStep] = useState<1 | 2>(1)
  const [submittedData, setSubmittedData] =
    useState<RegistrationData | null>(null)

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    } as RegistrationData,
    // Form-level onChange validation triggers as the user types.
    // We use the `zodValidator` from `@tanstack/zod-form-adapter` as the
    // validator adapter, which provides Zod-aware error formatting
    // (joining issue messages with commas) whenever a Zod schema is used
    // as a validator on a field or on the form itself.
    validatorAdapter: zodValidator() as never,
    validators: {
      onChange: registrationSchema,
    },
    onSubmit: async ({ value }) => {
      // Stash the submitted data so we can render the success message
      setSubmittedData(value)
    },
  })

  const goToNextStep = async () => {
    // Trigger onChange validation across all fields
    await form.validateAllFields('change')

    // Inspect each step 1 field's error map to decide whether to advance.
    const firstNameErrors =
      form.getFieldMeta('firstName')?.errors?.filter(Boolean) ?? []
    const lastNameErrors =
      form.getFieldMeta('lastName')?.errors?.filter(Boolean) ?? []

    if (firstNameErrors.length === 0 && lastNameErrors.length === 0) {
      setStep(2)
    }
  }

  const goToPreviousStep = () => {
    setStep(1)
  }

  if (submittedData) {
    return (
      <div className="registration-success">
        <div id="success-message" data-testid="success-message">
          <h2>Registration successful! 🎉</h2>
          <p>Here is the data that was submitted:</p>
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="registration-container">
      <header className="registration-header">
        <h1>Create your account</h1>
        <p className="step-indicator">
          Step {step} of 2 — {step === 1 ? 'User info' : 'Account info'}
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (step === 1) {
            void goToNextStep()
          } else {
            void form.handleSubmit()
          }
        }}
      >
        {step === 1 && (
          <fieldset className="form-step">
            <legend>User information</legend>

            <form.Field
              name="firstName"
              validators={{
                // Per-field onChange validation triggers as the user types
                onChange: firstNameSchema,
              }}
            >
              {(field) => {
                const errors = [...(field.state.meta.errors ?? [])].filter(
                  Boolean,
                )
                const showError =
                  field.state.meta.isTouched && errors.length > 0
                return (
                  <div className="form-field">
                    <label htmlFor={field.name}>First name</label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      REDACTEDComplete="given-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={showError || undefined}
                      aria-describedby={
                        showError ? `${field.name}-error` : undefined
                      }
                    />
                    {showError && (
                      <span
                        id={`${field.name}-error`}
                        className="field-error"
                        role="alert"
                      >
                        {errors.join(', ')}
                      </span>
                    )}
                  </div>
                )
              }}
            </form.Field>

            <form.Field
              name="lastName"
              validators={{
                onChange: lastNameSchema,
              }}
            >
              {(field) => {
                const errors = [...(field.state.meta.errors ?? [])].filter(
                  Boolean,
                )
                const showError =
                  field.state.meta.isTouched && errors.length > 0
                return (
                  <div className="form-field">
                    <label htmlFor={field.name}>Last name</label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      REDACTEDComplete="family-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={showError || undefined}
                      aria-describedby={
                        showError ? `${field.name}-error` : undefined
                      }
                    />
                    {showError && (
                      <span
                        id={`${field.name}-error`}
                        className="field-error"
                        role="alert"
                      >
                        {errors.join(', ')}
                      </span>
                    )}
                  </div>
                )
              }}
            </form.Field>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                Next
              </button>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="form-step">
            <legend>Account information</legend>

            <form.Field
              name="email"
              validators={{
                onChange: emailSchema,
              }}
            >
              {(field) => {
                const errors = [...(field.state.meta.errors ?? [])].filter(
                  Boolean,
                )
                const showError =
                  field.state.meta.isTouched && errors.length > 0
                return (
                  <div className="form-field">
                    <label htmlFor={field.name}>Email</label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="email"
                      REDACTEDComplete="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={showError || undefined}
                      aria-describedby={
                        showError ? `${field.name}-error` : undefined
                      }
                    />
                    {showError && (
                      <span
                        id={`${field.name}-error`}
                        className="field-error"
                        role="alert"
                      >
                        {errors.join(', ')}
                      </span>
                    )}
                  </div>
                )
              }}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: passwordSchema,
              }}
            >
              {(field) => {
                const errors = [...(field.state.meta.errors ?? [])].filter(
                  Boolean,
                )
                const showError =
                  field.state.meta.isTouched && errors.length > 0
                return (
                  <div className="form-field">
                    <label htmlFor={field.name}>Password</label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="password"
                      REDACTEDComplete="new-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={showError || undefined}
                      aria-describedby={
                        showError ? `${field.name}-error` : undefined
                      }
                    />
                    {showError && (
                      <span
                        id={`${field.name}-error`}
                        className="field-error"
                        role="alert"
                      >
                        {errors.join(', ')}
                      </span>
                    )}
                  </div>
                )
              }}
            </form.Field>

            <div className="form-actions form-actions-split">
              <button
                type="button"
                className="secondary-button"
                onClick={goToPreviousStep}
              >
                Back
              </button>
              <button type="submit" className="primary-button">
                Submit
              </button>
            </div>
          </fieldset>
        )}
      </form>
    </div>
  )
}

export default RegistrationForm