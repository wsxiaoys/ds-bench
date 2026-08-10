import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getCurrentUser, loginUser } from '#/server/auth.functions'

function sanitizeRedirect(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/dashboard'
  }
  return value
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    if (!search.redirect) return {}
    return { redirect: sanitizeRedirect(search.redirect) }
  },
  beforeLoad: async ({ search }) => {
    const user = await getCurrentUser()
    if (user) {
      throw redirect({ to: search.redirect ?? '/dashboard' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const loginFn = useServerFn(loginUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await loginFn({ data: { username, password } })
      await navigate({ to: search.redirect ?? '/dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Username</span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Need an account?{' '}
        <Link to="/register" className="text-blue-600 underline">
          Register
        </Link>
      </p>
    </div>
  )
}
