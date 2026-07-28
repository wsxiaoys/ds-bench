import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings')({
  component: DashboardSettingsComponent,
})

function DashboardSettingsComponent() {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Dashboard Settings
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Manage your account preferences here.
        </p>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <p className="p-6 text-gray-600">
          This is the settings page under the protected dashboard route subtree.
        </p>
      </div>
      <div className="mt-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
