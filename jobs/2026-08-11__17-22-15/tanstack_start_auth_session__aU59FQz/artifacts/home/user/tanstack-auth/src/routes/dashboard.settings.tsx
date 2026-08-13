import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  component: DashboardSettings,
})

function DashboardSettings() {
  const { user } = Route.useRouteContext()

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Settings</h1>
      <p className="text-gray-600 mb-6">
        Manage your profile settings for <span className="font-semibold text-gray-900">{user?.username}</span>.
      </p>
      <div className="border-t border-gray-200 pt-4 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Security</h3>
          <p className="text-sm text-gray-500">Your password is stored securely as a salted hash.</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <p className="text-sm text-gray-700">
            Authentication status: <span className="text-green-600 font-semibold">Active Session</span>
          </p>
        </div>
      </div>
    </div>
  )
}
