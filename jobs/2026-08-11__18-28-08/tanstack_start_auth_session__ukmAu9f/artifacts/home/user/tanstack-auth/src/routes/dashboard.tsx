import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { getCurrentUser, logoutUser } from '../auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
    return { user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const router = useRouter()

  const handleLogout = async () => {
    await logoutUser()
    router.invalidate()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold text-gray-900">App Dashboard</span>
              <Link
                to="/dashboard"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                activeProps={{ className: 'text-indigo-600 font-semibold' }}
              >
                Home
              </Link>
              <Link
                to="/dashboard/settings"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                activeProps={{ className: 'text-indigo-600 font-semibold' }}
              >
                Settings
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Logged in as: <strong>{user.username}</strong></span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl p-6 sm:p-8">
        <Outlet />
      </main>
    </div>
  )
}
