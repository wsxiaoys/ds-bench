import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMeFn, getUsersFn, setRoleFn, logoutFn } from '../server-functions'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getMeFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  loader: async () => {
    const users = await getUsersFn()
    return { users }
  },
  component: AdminComponent,
})

function AdminComponent() {
  const { users } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null)

  const handleRoleChange = async (email: string, newRole: 'admin' | 'user') => {
    setError(null)
    setUpdatingEmail(email)
    try {
      await setRoleFn({ data: { email, role: newRole } })
      await router.invalidate()
    } catch (err: any) {
      setError(err.message || 'Failed to update role')
    } finally {
      setUpdatingEmail(null)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutFn()
      navigate({ to: '/login' })
    } catch (err) {
      console.error('Logout failed', err)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>ADMIN CONSOLE 8842</h1>
          <p style={{ color: '#4b5563', margin: '0.25rem 0 0 0' }}>Logged in as: <strong>{user?.email}</strong> ({user?.role})</p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '4px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '1rem', fontWeight: u.email === user?.email ? 'bold' : 'normal' }}>
                  {u.email} {u.email === user?.email && <span style={{ fontSize: '0.75rem', color: '#2563eb', backgroundColor: '#dbeafe', padding: '0.125rem 0.375rem', borderRadius: '9999px', marginLeft: '0.5rem' }}>You</span>}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    fontSize: '0.875rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: u.role === 'admin' ? '#dcfce7' : '#f3f4f6',
                    color: u.role === 'admin' ? '#15803d' : '#374151',
                    fontWeight: 'bold'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <select
                    value={u.role}
                    disabled={updatingEmail === u.email}
                    onChange={(e) => handleRoleChange(u.email, e.target.value as 'admin' | 'user')}
                    style={{
                      padding: '0.375rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="admin">admin</option>
                    <option value="user">user</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
