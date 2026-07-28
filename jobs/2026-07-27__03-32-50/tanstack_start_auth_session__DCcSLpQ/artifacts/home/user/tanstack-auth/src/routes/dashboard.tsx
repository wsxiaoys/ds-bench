import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { getCurrentUser, logoutUser } from '#/server/auth.functions'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    // Server-side authorization check -- this calls a TanStack Start
    // server function which re-validates the session cookie against the
    // SQLite-backed sessions table on the server, regardless of whether
    // this beforeLoad executes during SSR or a client-side navigation.
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const logoutFn = useServerFn(logoutUser)

  const handleLogout = async () => {
    await logoutFn()
    await navigate({ to: '/login' })
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          {user && (
            <p className="text-sm text-gray-600">
              Signed in as <strong>{user.username}</strong>
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="rounded bg-gray-800 px-4 py-2 font-semibold text-white"
        >
          Logout
        </button>
      </header>
      <Outlet />
    </div>
  )
}
