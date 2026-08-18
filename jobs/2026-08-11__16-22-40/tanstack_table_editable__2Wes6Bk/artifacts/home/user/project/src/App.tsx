import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  RowData,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import {
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Users,
  Shield,
  Mail,
  AlertCircle,
  UserCheck,
} from 'lucide-react'
import './App.css'

// 1. Define the User type
interface User {
  id: string
  name: string
  email: string
  role: string
}

// 2. Extend TanStack Table options meta to be type-safe
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    editingId: string | null
    form: any
    startEdit: (user: User) => void
    cancelEdit: () => void
    deleteUser: (id: string) => void
  }
}

// 3. Define the Table Columns statically outside the component
// This prevents recreation on every render, which would lose input focus.
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ getValue }) => (
      <span className="id-badge">#{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row, getValue, table }) => {
      const { editingId, form } = table.options.meta || {}
      const isEditing = row.original.id === editingId

      if (isEditing && form) {
        return (
          <form.Field
            key={`${editingId}-name`}
            name="name"
            validators={{
              onChange: ({ value }: { value: string }) => {
                if (!value || value.trim() === '') return 'Name is required'
                if (value.trim().length < 2) return 'Name must be at least 2 characters'
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="field-group">
                <input
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`input-field ${
                    field.state.meta.errors.length ? 'input-error' : ''
                  }`}
                  placeholder="Enter name"
                  autoFocus
                />
                {field.state.meta.errors.length ? (
                  <span className="error-message">
                    {field.state.meta.errors.join(', ')}
                  </span>
                ) : null}
              </div>
            )}
          </form.Field>
        )
      }

      return (
        <div className="name-cell">
          <span className="user-name">{getValue() as string}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: 'Email Address',
    cell: ({ row, getValue, table }) => {
      const { editingId, form } = table.options.meta || {}
      const isEditing = row.original.id === editingId

      if (isEditing && form) {
        return (
          <form.Field
            key={`${editingId}-email`}
            name="email"
            validators={{
              onChange: ({ value }: { value: string }) => {
                if (!value || value.trim() === '') return 'Email is required'
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!emailRegex.test(value)) return 'Invalid email address'
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="field-group">
                <input
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`input-field ${
                    field.state.meta.errors.length ? 'input-error' : ''
                  }`}
                  placeholder="Enter email"
                />
                {field.state.meta.errors.length ? (
                  <span className="error-message">
                    {field.state.meta.errors.join(', ')}
                  </span>
                ) : null}
              </div>
            )}
          </form.Field>
        )
      }

      return (
        <div className="email-cell">
          <Mail size={14} className="email-icon" />
          <span className="user-email">{getValue() as string}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row, getValue, table }) => {
      const { editingId, form } = table.options.meta || {}
      const isEditing = row.original.id === editingId

      if (isEditing && form) {
        return (
          <form.Field
            key={`${editingId}-role`}
            name="role"
            validators={{
              onChange: ({ value }: { value: string }) => {
                if (!value || value.trim() === '') return 'Role is required'
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="field-group">
                <select
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`select-field ${
                    field.state.meta.errors.length ? 'input-error' : ''
                  }`}
                >
                  <option value="">Select Role</option>
                  <option value="Admin">Admin</option>
                  <option value="User">User</option>
                  <option value="Manager">Manager</option>
                  <option value="Developer">Developer</option>
                </select>
                {field.state.meta.errors.length ? (
                  <span className="error-message">
                    {field.state.meta.errors.join(', ')}
                  </span>
                ) : null}
              </div>
            )}
          </form.Field>
        )
      }

      const role = getValue() as string
      let badgeClass = 'badge-user'
      if (role === 'Admin') badgeClass = 'badge-admin'
      else if (role === 'Manager') badgeClass = 'badge-manager'
      else if (role === 'Developer') badgeClass = 'badge-developer'

      return <span className={`badge ${badgeClass}`}>{role}</span>
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const { editingId, form, startEdit, cancelEdit, deleteUser } =
        table.options.meta || {}
      const isEditing = row.original.id === editingId

      if (isEditing) {
        return (
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-save"
              onClick={() => form.handleSubmit()}
              title="Save changes"
            >
              <Check size={16} />
              <span>Save</span>
            </button>
            <button
              type="button"
              className="btn btn-cancel"
              onClick={cancelEdit}
              title="Cancel editing"
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>
        )
      }

      return (
        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-edit"
            onClick={() => startEdit(row.original)}
            disabled={editingId !== null}
            title={
              editingId !== null
                ? 'Finish editing current row first'
                : 'Edit user'
            }
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="btn btn-delete"
            onClick={() => deleteUser(row.original.id)}
            disabled={editingId !== null}
            title={
              editingId !== null
                ? 'Finish editing current row first'
                : 'Delete user'
            }
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    },
  },
]

// 4. Initial mock user records (at least 3 records)
const initialUsers: User[] = [
  {
    id: '1',
    name: 'Sarah Connor',
    email: 'sarah.connor@sky-net.io',
    role: 'Admin',
  },
  {
    id: '2',
    name: 'John Connor',
    email: 'john.connor@resistance.net',
    role: 'Manager',
  },
  {
    id: '3',
    name: 'Marcus Wright',
    email: 'marcus.wright@project-angel.com',
    role: 'Developer',
  },
  {
    id: '4',
    name: 'Kyle Reese',
    email: 'kyle.reese@tech-com.org',
    role: 'User',
  },
]

function App() {
  const [data, setData] = useState<User[]>(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  // Helper to show a feedback toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  // 5. Initialize TanStack Form
  const form = useForm({
    defaultValues: {
      id: '',
      name: '',
      email: '',
      role: '',
    },
    onSubmit: async ({ value }) => {
      // Form validation passed. Save changes.
      setData((prev) =>
        prev.map((user) => (user.id === value.id ? value : user))
      )
      setEditingId(null)
      showToast(`User "${value.name}" saved successfully!`, 'success')
    },
  })

  // Start editing a row
  const startEdit = (user: User) => {
    setEditingId(user.id)
    form.reset(user)
    showToast(`Editing user #${user.id}`, 'info')
  }

  // Cancel editing
  const cancelEdit = () => {
    // If it's a newly added user with empty fields, remove it from the list
    const editingUser = data.find((u) => u.id === editingId)
    if (editingUser && (!editingUser.name || !editingUser.email)) {
      setData((prev) => prev.filter((u) => u.id !== editingId))
      showToast('New user creation cancelled', 'info')
    } else {
      showToast('Editing cancelled', 'info')
    }
    setEditingId(null)
    form.reset({ id: '', name: '', email: '', role: '' })
  }

  // Delete a user
  const deleteUser = (id: string) => {
    const user = data.find((u) => u.id === id)
    if (user) {
      if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
        setData((prev) => prev.filter((u) => u.id !== id))
        showToast(`User "${user.name}" deleted successfully`, 'success')
      }
    }
  }

  // Add a new user inline
  const addUser = () => {
    if (editingId !== null) {
      showToast('Please save or cancel your current edit first.', 'error')
      return
    }

    // Generate a new unique ID
    const nextId = (
      data.reduce((max, u) => Math.max(max, parseInt(u.id) || 0), 0) + 1
    ).toString()

    const newUser: User = {
      id: nextId,
      name: '',
      email: '',
      role: 'User',
    }

    // Append new user to the list, then enter edit mode
    setData((prev) => [...prev, newUser])
    setEditingId(nextId)
    form.reset(newUser)
    showToast('Add new user details below', 'info')
  }

  // 6. Initialize TanStack Table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editingId,
      form,
      startEdit,
      cancelEdit,
      deleteUser,
    },
  })

  // Calculate statistics for the dashboard header
  const totalUsers = data.length
  const adminCount = data.filter((u) => u.role === 'Admin').count || data.filter((u) => u.role === 'Admin').length
  const developerCount = data.filter((u) => u.role === 'Developer').length

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <AlertCircle size={18} className="toast-icon" />
          <span className="toast-message">{toast.message}</span>
          <button onClick={() => setToast(null)} className="toast-close">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-icon-wrapper">
            <Users size={28} className="header-icon" />
          </div>
          <div>
            <h1>User Management</h1>
            <p className="header-subtitle">
              Manage your team members and roles with TanStack Table & TanStack Form inline editing.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-add" onClick={addUser}>
          <Plus size={18} />
          <span>Add User</span>
        </button>
      </header>

      {/* Stats Cards */}
      <section className="stats-section">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{totalUsers}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper red">
            <Shield size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Administrators</span>
            <span className="stat-value">{adminCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper purple">
            <UserCheck size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Developers</span>
            <span className="stat-value">{developerCount}</span>
          </div>
        </div>
      </section>

      {/* Table Card */}
      <main className="table-card">
        {data.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <h3>No users found</h3>
            <p>Get started by adding a new user to the list.</p>
            <button type="button" className="btn btn-add" onClick={addUser}>
              <Plus size={16} />
              <span>Add First User</span>
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
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
                  const isEditing = row.original.id === editingId
                  return (
                    <tr
                      key={row.id}
                      className={`${isEditing ? 'row-editing' : ''}`}
                    >
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
        )}
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>
          Powered by <strong>TanStack Table v9</strong> and{' '}
          <strong>TanStack Form v1</strong>.
        </p>
      </footer>
    </div>
  )
}

export default App
