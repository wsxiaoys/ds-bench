import { createFileRoute, Link, useNavigate, useLoaderData } from '@tanstack/react-router'
import { logoutUser } from '../../auth-functions'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const navigate = useNavigate()
  const { user } = useLoaderData({ from: '/dashboard' })

  const handleLogout = async () => {
    try {
      const res = await logoutUser()
      if (res.success) {
        navigate({ to: '/login' })
      }
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          User Dashboard
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Welcome back, <span className="font-bold text-indigo-600">{user?.username}</span>!
        </p>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Username</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {user?.username}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 flex space-x-4">
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
