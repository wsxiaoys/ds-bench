import { createFileRoute, Link } from '@tanstack/react-router'
import { getCurrentUser } from '../auth-functions'

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getCurrentUser()
    return { user }
  },
  component: Home,
})

function Home() {
  const { user } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-extrabold text-indigo-600 tracking-tight sm:text-5xl">
            TanStack Start Auth
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            A secure, full-stack session-based authentication system built with TanStack Start, React, and SQLite.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          {user ? (
            <div>
              <p className="text-gray-700 mb-4">
                You are currently logged in as <span className="font-semibold text-indigo-600">{user.username}</span>.
              </p>
              <Link
                to="/dashboard"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-700 mb-4">Welcome! Please sign in or register to get started.</p>
              <div className="grid grid-cols-2 gap-4">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2 px-4 border border-indigo-600 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
