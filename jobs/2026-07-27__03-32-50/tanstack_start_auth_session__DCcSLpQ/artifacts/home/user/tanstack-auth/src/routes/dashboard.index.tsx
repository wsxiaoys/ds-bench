import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
})

function DashboardIndex() {
  const { user } = Route.useRouteContext()

  return (
    <div>
      <p className="text-lg">
        Welcome back, <strong>{user?.username}</strong>!
      </p>
      <p className="mt-2 text-gray-600">
        This is your protected dashboard. Only authenticated users can see
        this page.
      </p>
      <p className="mt-4">
        <Link to="/dashboard/settings" className="text-blue-600 underline">
          Go to settings
        </Link>
      </p>
    </div>
  )
}
