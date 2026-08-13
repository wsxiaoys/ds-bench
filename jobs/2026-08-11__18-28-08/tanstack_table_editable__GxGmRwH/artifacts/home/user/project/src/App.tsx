import { useState, useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import './App.css'

interface User {
  id: string
  name: string
  email: string
  role: string
}

const initialUsers: User[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
  { id: '2', name: 'Bob Jones', email: 'bob@example.com', role: 'User' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Editor' },
]

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, User>()

function App() {
  const [data, setData] = useState<User[]>(initialUsers)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // TanStack Form instance to manage inline edit state and validation
  const form = useForm({
    defaultValues: {
      id: '',
      name: '',
      email: '',
      role: '',
    } as User,
    onSubmit: async ({ value }) => {
      // Clear errors on successful submit
      setValidationErrors([])
      // Update data state with edited values
      setData((prev) =>
        prev.map((user) => (user.id === value.id ? value : user))
      )
      // Exit edit mode
      setEditingRowId(null)
    },
    onSubmitInvalid: ({ formApi }) => {
      // Collect errors to display a summary if validation fails
      const errorsList: string[] = []
      const state = formApi.state
      
      // Look through field-level errors
      Object.keys(state.values).forEach((key) => {
        const fieldMeta = formApi.getFieldMeta(key as keyof User)
        if (fieldMeta?.errors?.length) {
          errorsList.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${fieldMeta.errors.join(', ')}`)
        }
      })
      setValidationErrors(errorsList)
    }
  })

  const handleStartEdit = (user: User) => {
    setEditingRowId(user.id)
    setValidationErrors([])
    // Reset form to the selected user's values
    form.reset(user)
  }

  const handleCancel = () => {
    setEditingRowId(null)
    setValidationErrors([])
    form.reset()
  }

  // TanStack Table columns definition
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('id', {
          header: 'ID',
          cell: (info) => <span className="id-badge">{info.getValue()}</span>,
        }),
        columnHelper.accessor('name', {
          header: 'Name',
          cell: (info) => {
            const rowId = info.row.original.id
            const isEditing = editingRowId === rowId

            if (isEditing) {
              return (
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || !value.trim()) {
                        return 'Name is required'
                      }
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="input-container">
                      <input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={`edit-input ${
                          field.state.meta.errors.length ? 'input-error' : ''
                        }`}
                        placeholder="Name"
                      />
                      {field.state.meta.errors.length ? (
                        <span className="error-text">
                          {field.state.meta.errors.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </form.Field>
              )
            }

            return <span className="user-name">{info.getValue()}</span>
          },
        }),
        columnHelper.accessor('email', {
          header: 'Email',
          cell: (info) => {
            const rowId = info.row.original.id
            const isEditing = editingRowId === rowId

            if (isEditing) {
              return (
                <form.Field
                  name="email"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || !value.trim()) {
                        return 'Email is required'
                      }
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                      if (!emailRegex.test(value)) {
                        return 'Invalid email format'
                      }
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="input-container">
                      <input
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={`edit-input ${
                          field.state.meta.errors.length ? 'input-error' : ''
                        }`}
                        placeholder="Email"
                      />
                      {field.state.meta.errors.length ? (
                        <span className="error-text">
                          {field.state.meta.errors.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </form.Field>
              )
            }

            return <span className="user-email">{info.getValue()}</span>
          },
        }),
        columnHelper.accessor('role', {
          header: 'Role',
          cell: (info) => {
            const rowId = info.row.original.id
            const isEditing = editingRowId === rowId

            if (isEditing) {
              return (
                <form.Field
                  name="role"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || !value.trim()) {
                        return 'Role is required'
                      }
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="input-container">
                      <select
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={`edit-select ${
                          field.state.meta.errors.length ? 'input-error' : ''
                        }`}
                      >
                        <option value="">Select Role</option>
                        <option value="Admin">Admin</option>
                        <option value="User">User</option>
                        <option value="Editor">Editor</option>
                      </select>
                      {field.state.meta.errors.length ? (
                        <span className="error-text">
                          {field.state.meta.errors.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </form.Field>
              )
            }

            const roleValue = info.getValue()
            return <span className={`role-badge ${roleValue}`}>{roleValue}</span>
          },
        }),
        columnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => {
            const rowId = info.row.original.id
            const isEditing = editingRowId === rowId

            if (isEditing) {
              return (
                <div className="action-buttons">
                  <button
                    type="submit"
                    className="btn btn-save"
                    title="Save changes"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-cancel"
                    onClick={handleCancel}
                    title="Cancel editing"
                  >
                    Cancel
                  </button>
                </div>
              )
            }

            return (
              <div className="action-buttons">
                <button
                  type="button"
                  className="btn btn-edit"
                  onClick={() => handleStartEdit(info.row.original)}
                  disabled={editingRowId !== null}
                  title="Edit this user"
                >
                  Edit
                </button>
              </div>
            )
          },
        }),
      ]),
    [editingRowId, form]
  )

  const table = useTable({
    data,
    columns,
    features,
  })

  return (
    <div className="container">
      <div className="header">
        <h1>User Directory</h1>
        <p>Manage user accounts and roles with inline editing capabilities.</p>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-summary">
          <strong>Please fix the following validation errors:</strong>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      <div className="demo-info">
        <h3>How it works</h3>
        <p>
          This table uses <strong>TanStack Table v9</strong> to manage columns, rows, and cellular rendering.
          When you click "Edit", the row switches into edit mode, and <strong>TanStack Form</strong> takes over
          the state of that row. It performs real-time validation (e.g. name is required, email must be valid)
          and prevents saving unless all criteria are met.
        </p>
      </div>
    </div>
  )
}

export default App
