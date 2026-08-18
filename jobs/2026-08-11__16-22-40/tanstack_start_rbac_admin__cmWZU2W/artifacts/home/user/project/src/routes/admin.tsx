import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { getUserFn, getUsersFn, logoutFn, setRoleFn } from '../serverFunctions'
import * as React from 'react'

export const Route = createFileRoute('/admin')({
  loader: async () => {
    const user = await getUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/' })
    }
    
    const users = await getUsersFn()
    return { user, users }
  },
  component: AdminComponent,
})

function AdminComponent() {
  const { user, users } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const [error, setError] = React.useState('')
  const [updatingEmail, setUpdatingEmail] = React.useState<string | null>(null)

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  const handleRoleChange = async (email: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    setError('')
    setUpdatingEmail(email)
    try {
      await setRoleFn({ data: { email, role: newRole } })
      // Reload loader data
      await router.invalidate()
    } catch (err: any) {
      setError(err.message || 'Failed to update role')
    } finally {
      setUpdatingEmail(null)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>ADMIN CONSOLE 8842</h1>
        <div>
          <span style={{ marginRight: '1rem', color: '#4b5563' }}>Logged in as: <strong>{user.email}</strong></span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Current Role</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '1rem' }}>{u.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: u.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                    color: u.role === 'admin' ? '#1e40af' : '#374151'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleRoleChange(u.email, u.role)}
                    disabled={updatingEmail !== null}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: u.role === 'admin' ? '#f3f4f6' : '#2563eb',
                      color: u.role === 'admin' ? '#374151' : 'white',
                      border: '1px solid',
                      borderColor: u.role === 'admin' ? '#d1d5db' : '#2563eb',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    {updatingEmail === u.email ? 'Updating...' : `Change to ${u.role === 'admin' ? 'user' : 'admin'}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
