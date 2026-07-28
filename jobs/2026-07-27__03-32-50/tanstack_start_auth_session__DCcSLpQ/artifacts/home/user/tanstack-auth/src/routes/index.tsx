import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">TanStack Start Auth Demo</h1>
      <p className="mt-4 text-lg">
        Session-based authentication backed by a local SQLite database.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          to="/login"
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Log in
        </Link>
        <Link
          to="/register"
          className="rounded border border-blue-600 px-4 py-2 font-semibold text-blue-600"
        >
          Register
        </Link>
        <Link
          to="/dashboard"
          className="rounded border border-gray-400 px-4 py-2 font-semibold text-gray-700"
        >
          Dashboard
        </Link>
      </div>
    </div>
  )
}
