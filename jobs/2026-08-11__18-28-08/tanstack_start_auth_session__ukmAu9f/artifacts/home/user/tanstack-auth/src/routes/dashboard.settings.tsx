import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  component: DashboardSettings,
})

function DashboardSettings() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Settings</h1>
      <p className="text-gray-600">
        This is the settings page, which is also protected and requires authentication to access.
      </p>
    </div>
  )
}
