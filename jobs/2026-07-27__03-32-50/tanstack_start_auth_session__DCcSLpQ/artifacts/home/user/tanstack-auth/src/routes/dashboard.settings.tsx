import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  component: DashboardSettings,
})

function DashboardSettings() {
  const { user } = Route.useRouteContext()

  return (
    <div>
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="mt-2 text-gray-600">
        Account settings for <strong>{user?.username}</strong>. This nested
        route is also protected by the parent dashboard route's{' '}
        <code>beforeLoad</code> guard.
      </p>
    </div>
  )
}
