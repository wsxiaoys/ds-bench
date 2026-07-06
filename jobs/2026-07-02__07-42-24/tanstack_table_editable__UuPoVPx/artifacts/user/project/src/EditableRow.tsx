import { useForm } from '@tanstack/react-form';
import type { Row } from '@tanstack/react-table';
import type { User } from './types';
import { Save, X } from 'lucide-react';

interface EditableRowProps {
  row: Row<User>;
  onSave: (updatedUser: User) => void;
  onCancel: () => void;
}

export const EditableRow = ({ row, onSave, onCancel }: EditableRowProps) => {
  const user = row.original;

  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    onSubmit: async ({ value }) => {
      onSave({
        id: user.id,
        name: value.name.trim(),
        email: value.email.trim(),
        role: value.role,
      });
    },
  });

  return (
    <tr className="bg-indigo-50/30 dark:bg-indigo-950/10 border-b border-gray-200 dark:border-gray-800">
      {/* ID Column */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
        {user.id}
      </td>

      {/* Name Column */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Name is required';
              }
              if (value.trim().length < 2) {
                return 'Name must be at least 2 characters';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={`px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border ${
                  field.state.meta.errors.length
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
                } rounded-md shadow-sm focus:outline-none focus:ring-2 block w-full max-w-xs transition-all`}
                placeholder="Enter name"
                autoFocus
              />
              {field.state.meta.errors.length ? (
                <span className="text-xs text-red-500 font-medium">
                  {field.state.meta.errors.join(', ')}
                </span>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>

      {/* Email Column */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Email is required';
              }
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value.trim())) {
                return 'Invalid email address format';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={`px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border ${
                  field.state.meta.errors.length
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
                } rounded-md shadow-sm focus:outline-none focus:ring-2 block w-full max-w-xs transition-all`}
                placeholder="Enter email"
              />
              {field.state.meta.errors.length ? (
                <span className="text-xs text-red-500 font-medium">
                  {field.state.meta.errors.join(', ')}
                </span>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>

      {/* Role Column */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        <form.Field
          name="role"
          validators={{
            onChange: ({ value }) => {
              if (!value) {
                return 'Role is required';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <select
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full max-w-xs transition-all"
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="User">User</option>
                <option value="Viewer">Viewer</option>
              </select>
              {field.state.meta.errors.length ? (
                <span className="text-xs text-red-500 font-medium">
                  {field.state.meta.errors.join(', ')}
                </span>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>

      {/* Actions Column */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => form.handleSubmit()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-md shadow-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
};
