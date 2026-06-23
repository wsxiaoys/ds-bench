import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'

type User = {
  id: number
  name: string
  email: string
  role: string
}

const initialData: User[] = [
  { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
  { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'User' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Editor' },
]

const columnHelper = createColumnHelper<User>()

function App() {
  const [data, setData] = useState(() => initialData)
  const [editingRowId, setEditingRowId] = useState<number | null>(null)

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        if (editingRowId === info.row.original.id) {
          return null // Handled in row render
        }
        return info.getValue()
      },
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => {
        if (editingRowId === info.row.original.id) {
          return null
        }
        return info.getValue()
      },
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => {
        if (editingRowId === info.row.original.id) {
          return null
        }
        return info.getValue()
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        if (editingRowId === info.row.original.id) {
          return null
        }
        return (
          <button
            onClick={() => setEditingRowId(info.row.original.id)}
            className="px-2 py-1 bg-blue-500 text-white rounded"
          >
            Edit
          </button>
        )
      },
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-gray-100">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border border-gray-300 px-4 py-2 text-left">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
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
            if (editingRowId === row.original.id) {
              return (
                <EditableRow
                  key={row.id}
                  user={row.original}
                  onSave={(updatedUser) => {
                    setData((prev) =>
                      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
                    )
                    setEditingRowId(null)
                  }}
                  onCancel={() => setEditingRowId(null)}
                />
              )
            }

            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border border-gray-300 px-4 py-2">
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

function EditableRow({
  user,
  onSave,
  onCancel,
}: {
  user: User
  onSave: (user: User) => void
  onCancel: () => void
}) {
  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    onSubmit: async ({ value }) => {
      onSave({ ...user, ...value })
    },
  })

  return (
    <tr>
      <td className="border border-gray-300 px-4 py-2">{user.id}</td>
      <td className="border border-gray-300 px-4 py-2">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value ? 'Name is required' : undefined,
          }}
        >
          {(field) => (
            <div>
              <input
                className="border p-1 w-full"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors ? (
                <em className="text-red-500 text-sm">
                  {field.state.meta.errors.join(', ')}
                </em>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Email is required'
              if (!/^\S+@\S+\.\S+$/.test(value)) return 'Invalid email format'
              return undefined
            },
          }}
        >
          {(field) => (
            <div>
              <input
                className="border p-1 w-full"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors ? (
                <em className="text-red-500 text-sm">
                  {field.state.meta.errors.join(', ')}
                </em>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <form.Field
          name="role"
          validators={{
            onChange: ({ value }) =>
              !value ? 'Role is required' : undefined,
          }}
        >
          {(field) => (
            <div>
              <input
                className="border p-1 w-full"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors ? (
                <em className="text-red-500 text-sm">
                  {field.state.meta.errors.join(', ')}
                </em>
              ) : null}
            </div>
          )}
        </form.Field>
      </td>
      <td className="border border-gray-300 px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => form.handleSubmit()}
            className="px-2 py-1 bg-green-500 text-white rounded"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

export default App
