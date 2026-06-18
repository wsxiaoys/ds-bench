import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import './App.css'

const initialUsers = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Editor' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Editor' },
]

function EditableCell({ rowId, user, form, onSave, onCancel }) {
  return (
    <tr className="edit-row">
      <td>{user.id}</td>
      <td>
        <form.Field name="name">
          {(field) => (
            <div className="field-wrapper">
              <input
                className={field.state.meta.errors.length > 0 ? 'input-error' : ''}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-text">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field name="email">
          {(field) => (
            <div className="field-wrapper">
              <input
                className={field.state.meta.errors.length > 0 ? 'input-error' : ''}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-text">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field name="role">
          {(field) => (
            <div className="field-wrapper">
              <select
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
          )}
        </form.Field>
      </td>
      <td className="actions-cell">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <button
                className="btn btn-save"
                onClick={() => {
                  form.handleSubmit()
                }}
                disabled={isSubmitting}
              >
                Save
              </button>
              <button className="btn btn-cancel" onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
        </form.Subscribe>
      </td>
    </tr>
  )
}

function App() {
  const [users, setUsers] = useState(initialUsers)
  const [editingId, setEditingId] = useState(null)

  const columns = useMemo(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'role', header: 'Role' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (row.original.id === editingId) return null
          return (
            <button
              className="btn btn-edit"
              onClick={() => setEditingId(row.original.id)}
            >
              Edit
            </button>
          )
        },
      },
    ],
    [editingId]
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const editingUser = users.find((u) => u.id === editingId)

  const handleSave = (values) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === editingId ? { ...u, ...values } : u))
    )
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  return (
    <div className="app-container">
      <h1>User Management</h1>
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            if (row.original.id === editingId) {
              return (
                <EditRowForm
                  key={row.id}
                  user={editingUser}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              )
            }
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditRowForm({ user, onSave, onCancel }) {
  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    validators: {
      onSubmit: ({ value }) => {
        const errors = {}
        if (!value.name || value.name.trim() === '') {
          errors.name = 'Name is required'
        }
        if (!value.email || value.email.trim() === '') {
          errors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
          errors.email = 'Invalid email format'
        }
        if (Object.keys(errors).length > 0) {
          return errors
        }
        return undefined
      },
    },
    onSubmit: ({ value }) => {
      onSave(value)
    },
  })

  return (
    <EditableCell
      rowId={user.id}
      user={user}
      form={form}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

export default App
