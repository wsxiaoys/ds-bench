import { createFileRoute, Link } from '@tanstack/react-router';
import { getCurrentUser } from '../utils/auth-functions';

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getCurrentUser();
    return { user };
  },
  component: Home,
});

function Home() {
  const { user } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          TanStack Start Auth
        </h1>
        <p className="mt-3 text-xl text-gray-500">
          Full-Stack Session Authentication with TanStack Start & SQLite
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-6">
          {user ? (
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-700">
                Logged in as <strong className="text-gray-900">{user.username}</strong>
              </p>
              <div className="flex flex-col space-y-2">
                <Link
                  to="/dashboard"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Go to Dashboard
                </Link>
                <Link
                  to="/dashboard/settings"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Go to Settings
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                You are not logged in.
              </p>
              <div className="flex flex-col space-y-2">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
