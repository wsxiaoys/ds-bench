import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { getCurrentUserFn, logoutFn } from '../server-fns'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => {
    const user = await getCurrentUserFn()
    return { user }
  },
  component: HomeComponent,
})

function HomeComponent() {
  const { user } = Route.useLoaderData()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0, color: '#1f2937' }}>Welcome Home</h1>
        <p style={{ fontSize: '1.1rem', color: '#4b5563' }}>You are logged in as:</p>
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '6px', margin: '1.5rem 0', textAlign: 'left' }}>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong>Email:</strong> {user?.email}</p>
          <p style={{ margin: 0 }}><strong>Role:</strong> {user?.role}</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate({ to: '/admin' })}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            Go to Admin Console
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '0.75rem',
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
    </div>
  )
}
