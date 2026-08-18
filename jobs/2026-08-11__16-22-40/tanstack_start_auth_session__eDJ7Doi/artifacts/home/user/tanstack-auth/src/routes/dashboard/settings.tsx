import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { getCurrentUser } from '../../utils/auth-functions';

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
    return { user };
  },
  component: SettingsComponent,
});

function SettingsComponent() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900">User Settings</h2>
      <p className="mt-2 text-gray-600">This is the nested protected settings page. Only authenticated users can see this page.</p>
      <div className="mt-4">
        <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-500 font-medium">
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
