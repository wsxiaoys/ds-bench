import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
})

function DashboardIndex() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to your Dashboard</h1>
      <p className="text-gray-600">
        This is a highly secure, session-authenticated area of the application.
      </p>
    </div>
  )
}
