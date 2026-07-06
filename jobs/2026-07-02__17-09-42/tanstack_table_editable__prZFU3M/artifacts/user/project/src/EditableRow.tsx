import { useForm } from '@tanstack/react-form';
import type { User } from './types';
import { ROLES } from './data';

interface EditableRowProps {
  user: User;
  onSave: (user: User) => void;
  onCancel: () => void;
}

// RFC5322 simplified email regex suitable for form validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditableRow({ user, onSave, onCancel }: EditableRowProps) {
  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    onSubmit: ({ value }) => {
      onSave({
        id: user.id,
        name: value.name,
        email: value.email,
        role: value.role,
      });
    },
  });

  return (
    <tr className="editable-row">
      <td>{user.id}</td>
      <td>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim().length === 0
                ? 'Name is required'
                : undefined,
            onBlur: ({ value }) =>
              !value || value.trim().length === 0
                ? 'Name is required'
                : undefined,
          }}
        >
          {(field) => (
            <div className="field-wrapper">
              <input
                type="text"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-label="Name"
                className={
                  field.state.meta.errors.length > 0 ? 'input-error' : ''
                }
              />
              {field.state.meta.errors.length > 0 && (
                <div className="error-message">
                  {String(field.state.meta.errors[0])}
                </div>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim().length === 0) {
                return 'Email is required';
              }
              if (!EMAIL_REGEX.test(value)) {
                return 'Email must be a valid format';
              }
              return undefined;
            },
            onBlur: ({ value }) => {
              if (!value || value.trim().length === 0) {
                return 'Email is required';
              }
              if (!EMAIL_REGEX.test(value)) {
                return 'Email must be a valid format';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="field-wrapper">
              <input
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-label="Email"
                className={
                  field.state.meta.errors.length > 0 ? 'input-error' : ''
                }
              />
              {field.state.meta.errors.length > 0 && (
                <div className="error-message">
                  {String(field.state.meta.errors[0])}
                </div>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field name="role">
          {(field) => (
            <select
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-label="Role"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          )}
        </form.Field>
      </td>
      <td>
        <div className="action-buttons">
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <button
                type="button"
                className="btn-save"
                disabled={!canSubmit || isSubmitting}
                onClick={() => form.handleSubmit()}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            )}
          </form.Subscribe>
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={form.state.isSubmitting}
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
