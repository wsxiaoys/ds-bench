import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import './App.css'

const initialData = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Editor' },
  { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'Viewer' },
  { id: 4, name: 'Dave Brown', email: 'dave@example.com', role: 'Editor' },
]

function EditableCell({ field, error, type = 'text' }) {
  return (
    <div className="editable-cell">
      <input
        type={type}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        className={error ? 'cell-input invalid' : 'cell-input'}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  )
}

function EditRow({ row, onSave, onCancel }) {
  const form = useForm({
    defaultValues: {
      name: row.original.name,
      email: row.original.email,
      role: row.original.role,
    },
    onSubmit: ({ value }) => {
      onSave(row.original.id, value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="edit-row-form"
    >
      <td className="cell-id">{row.original.id}</td>
      <td>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value || !value.trim() ? 'Name is required' : undefined,
            onBlur: ({ value }) =>
              !value || !value.trim() ? 'Name is required' : undefined,
          }}
        >
          {(field) => (
            <EditableCell field={field} error={field.state.meta.errors[0]} />
          )}
        </form.Field>
      </td>
      <td>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || !value.trim()) return 'Email is required'
              const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              return re.test(value) ? undefined : 'Invalid email format'
            },
            onBlur: ({ value }) => {
              if (!value || !value.trim()) return 'Email is required'
              const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              return re.test(value) ? undefined : 'Invalid email format'
            },
          }}
        >
          {(field) => (
            <EditableCell field={field} error={field.state.meta.errors[0]} />
          )}
        </form.Field>
      </td>
      <td>
        <form.Field name="role">
          {(field) => (
            <select
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="cell-input"
            >
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          )}
        </form.Field>
      </td>
      <td className="actions-cell">
        <form.Subscribe>
          {(state) => (
            <button
              type="submit"
              className="btn btn-save"
              disabled={state.isSubmitting}
            >
              Save
            </button>
          )}
        </form.Subscribe>
        <button type="button" className="btn btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </td>
    </form>
  )
}

export default function App() {
  const [data, setData] = useState(initialData)
  const [editingId, setEditingId] = useState(null)

  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => <span className="cell-id">{row.original.id}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'role',
        header: 'Role',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="actions-cell">
            <button
              className="btn btn-edit"
              onClick={() => setEditingId(row.original.id)}
            >
              Edit
            </button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editingId,
    },
  })

  const handleSave = (id, updatedValues) => {
    setData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updatedValues } : row))
    )
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  return (
    <div className="app-container">
      <h1>User Directory</h1>
      <p className="subtitle">
        Click <strong>Edit</strong> on a row to modify a user. Changes are
        validated before saving.
      </p>
      <div className="table-wrapper">
        <table>
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
                  <tr key={row.id} className="editing-row">
                    <EditRow
                      row={row}
                      onSave={handleSave}
                      onCancel={handleCancel}
                    />
                  </tr>
                )
              }
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="record-count">
        {data.length} user{data.length !== 1 ? 's' : ''} total
      </div>
    </div>
  )
}