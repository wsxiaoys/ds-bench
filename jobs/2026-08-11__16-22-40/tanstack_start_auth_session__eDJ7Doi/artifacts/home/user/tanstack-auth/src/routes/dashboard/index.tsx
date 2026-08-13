import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function DashboardIndex() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900">Welcome to your Dashboard!</h2>
      <p className="mt-2 text-gray-600">This is a protected route. Only authenticated users can see this page.</p>
      <div className="mt-4">
        <Link to="/dashboard/settings" className="text-indigo-600 hover:text-indigo-500 font-medium">
          Go to Settings &rarr;
        </Link>
      </div>
    </div>
  );
}
