import { useForm } from '@tanstack/react-form'
import { roles } from './data'

function FieldError({ field }) {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
    <span className="field-error">{field.state.meta.errors[0]}</span>
  ) : null
}

export default function EditableRow({ row, onSave, onCancel }) {
  const form = useForm({
    defaultValues: {
      name: row.name,
      email: row.email,
      role: row.role,
    },
    onSubmit: async ({ value }) => {
      onSave({ ...row, ...value })
    },
  })

  return (
    <tr className="editing-row">
      <td>{row.id}</td>

      {/* Name field */}
      <td>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim() === ''
                ? 'Name is required'
                : value.trim().length < 2
                ? 'Name must be at least 2 characters'
                : undefined,
          }}
        >
          {(field) => (
            <div className="field-wrapper">
              <input
                className={`edit-input ${field.state.meta.isTouched && field.state.meta.errors.length ? 'input-error' : ''}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Full name"
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>
      </td>

      {/* Email field */}
      <td>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') return 'Email is required'
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              if (!emailRegex.test(value.trim())) return 'Must be a valid email address'
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="field-wrapper">
              <input
                className={`edit-input ${field.state.meta.isTouched && field.state.meta.errors.length ? 'input-error' : ''}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Email address"
                type="email"
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>
      </td>

      {/* Role field */}
      <td>
        <form.Field
          name="role"
          validators={{
            onChange: ({ value }) =>
              !value ? 'Role is required' : undefined,
          }}
        >
          {(field) => (
            <div className="field-wrapper">
              <select
                className={`edit-select ${field.state.meta.isTouched && field.state.meta.errors.length ? 'input-error' : ''}`}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <FieldError field={field} />
            </div>
          )}
        </form.Field>
      </td>

      {/* Actions */}
      <td>
        <div className="action-buttons">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <button
                className="btn btn-save"
                type="button"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit()}
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
          <button className="btn btn-cancel" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}
