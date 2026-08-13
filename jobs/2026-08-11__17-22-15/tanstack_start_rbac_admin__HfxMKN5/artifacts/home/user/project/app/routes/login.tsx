import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getCurrentUserFn, loginFn } from '../serverFunctions'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (user && user.role === 'admin') {
      throw redirect({ to: '/admin' })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await loginFn({ data: { email, password } })
      
      let isSuccess = false
      let role = ''
      
      if (res instanceof Response) {
        if (res.ok) {
          const data = await res.json()
          isSuccess = true
          role = data.role
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Invalid credentials')
        }
      } else {
        isSuccess = (res as any).success
        role = (res as any).role
      }

      if (isSuccess) {
        if (role === 'admin') {
          navigate({ to: '/admin' })
        } else {
          setError('Access denied: not an admin.')
        }
      }
    } catch (err: any) {
      console.error(err)
      if (err instanceof Response) {
        const data = await err.json().catch(() => ({}))
        setError(data.error || 'Invalid credentials')
      } else {
        setError(err.message || 'Invalid credentials')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '5px', fontFamily: 'sans-serif' }}>
      <h2>Login</h2>
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
