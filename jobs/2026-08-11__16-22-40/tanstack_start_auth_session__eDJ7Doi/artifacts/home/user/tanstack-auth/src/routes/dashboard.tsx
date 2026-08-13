import { createFileRoute, redirect, Outlet, useNavigate } from '@tanstack/react-router';
import { getCurrentUser, logoutUser } from '../utils/auth-functions';

export const Route = createFileRoute('/dashboard')({
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
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate({ to: '/login' });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold text-gray-800">App Dashboard</span>
              <span className="text-sm text-gray-500">
                Logged in as: <strong className="text-gray-900">{user.username}</strong>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 px-4">
        <Outlet />
      </main>
    </div>
  );
}
