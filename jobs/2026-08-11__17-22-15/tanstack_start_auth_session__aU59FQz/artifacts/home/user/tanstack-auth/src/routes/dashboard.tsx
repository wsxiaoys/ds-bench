import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { getCurrentUser, logoutUser } from '../auth-functions'

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

  const handleLogout = async () => {
    await logoutUser()
    // Redirect to login after logout
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8 items-center">
              <span className="text-xl font-bold text-indigo-600">AuthApp</span>
              <Link
                to="/dashboard"
                className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium"
                activeProps={{ className: 'border-indigo-500 text-gray-900' }}
              >
                Dashboard
              </Link>
              <Link
                to="/dashboard/settings"
                className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium"
                activeProps={{ className: 'border-indigo-500 text-gray-900' }}
              >
                Settings
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 text-sm font-medium">
                Welcome, <span className="font-semibold">{user?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
