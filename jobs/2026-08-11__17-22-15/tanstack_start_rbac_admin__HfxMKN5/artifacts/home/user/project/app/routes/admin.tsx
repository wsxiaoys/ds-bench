import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { getAllUsersFn, getCurrentUserFn, logoutFn, setRoleFn } from '../serverFunctions'
import { useState } from 'react'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => {
    const users = await getAllUsersFn()
    return { users }
  },
  component: AdminComponent,
})

function AdminComponent() {
  const router = useRouter()
  const navigate = useNavigate()
  const { users } = Route.useLoaderData()
  const [error, setError] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null)

  const handleSetRole = async (email: string, role: string) => {
    setError('')
    setUpdatingEmail(email)
    try {
      await setRoleFn({ data: { email, role } })
      await router.invalidate()
    } catch (err: any) {
      console.error(err)
      if (err instanceof Response) {
        const data = await err.json().catch(() => ({}))
        setError(data.error || 'Failed to update role')
      } else {
        setError(err.message || 'Failed to update role')
      }
    } finally {
      setUpdatingEmail(null)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutFn()
      navigate({ to: '/login' })
    } catch (err) {
      console.error(err)
      navigate({ to: '/login' })
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>ADMIN CONSOLE 8842</h1>
        <button 
          onClick={handleLogout} 
          style={{ padding: '8px 16px', backgroundColor: '#e00', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      {error && <div style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Email</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Current Role</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.email}>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{user.email}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                <span style={{ 
                  padding: '4px 8px', 
                  borderRadius: '12px', 
                  fontSize: '0.85em', 
                  backgroundColor: user.role === 'admin' ? '#e2f5ea' : '#eee',
                  color: user.role === 'admin' ? '#007f30' : '#333'
                }}>
                  {user.role}
                </span>
              </td>
              <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                <select
                  value={user.role}
                  disabled={updatingEmail === user.email}
                  onChange={(e) => handleSetRole(user.email, e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                </select>
                {updatingEmail === user.email && <span style={{ marginLeft: '10px', fontSize: '0.9em', color: '#666' }}>Updating...</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
