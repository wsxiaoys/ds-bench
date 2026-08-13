import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          TanStack Start Auth
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          A full-stack session-based authentication system featuring TanStack Router, TanStack Start, and SQLite.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/login"
            className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Register
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
