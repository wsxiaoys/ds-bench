import { useState } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { getCurrentUserFn, getAllUsersFn, setRoleFn, logoutFn } from '../server-fns'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    const users = await getAllUsersFn()
    return { users }
  },
  component: AdminComponent,
})

function AdminComponent() {
  const { users } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleRoleChange = async (email: string, currentRole: 'admin' | 'user') => {
    setError('')
    setUpdatingEmail(email)
    const newRole = currentRole === 'admin' ? 'user' : 'admin'

    try {
      const result = await setRoleFn({ data: { email, role: newRole } })
      if (result && 'error' in result) {
        setError(result.error || 'Failed to update role')
      } else {
        await router.invalidate()
      }
    } catch (err: any) {
      setError('An error occurred while updating the role')
    } finally {
      setUpdatingEmail(null)
    }
  }

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>ADMIN CONSOLE 8842</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ef4444',
            color: 'white',
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
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
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
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    backgroundColor: u.role === 'admin' ? '#d1fae5' : '#e0f2fe',
                    color: u.role === 'admin' ? '#065f46' : '#0369a1'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleRoleChange(u.email, u.role as 'admin' | 'user')}
                    disabled={updatingEmail === u.email}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: updatingEmail === u.email ? 0.7 : 1
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
