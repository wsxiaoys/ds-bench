import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { getUserFn, logoutFn } from '../serverFunctions'
import * as React from 'react'

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role === 'admin') {
      throw redirect({ to: '/admin' })
    }
    return { user }
  },
  component: IndexComponent,
})

function IndexComponent() {
  const { user } = Route.useLoaderData()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logoutFn()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>User Dashboard</h1>
      <p>Welcome, <strong>{user.email}</strong>!</p>
      <p>Your role is: <strong>{user.role}</strong></p>
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
  )
}
