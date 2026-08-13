import { LoginForm, SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <Layout>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
        <p className="text-sm text-gray-600 mt-1">Access your collaborative documents</p>
      </div>
      <LoginForm />
      <div className="mt-4 text-center">
        <span className="text-sm font-medium text-gray-900">
          Don't have an account yet?{" "}
          <Link to="/signup" className="text-blue-600 hover:underline">
            go to signup
          </Link>
          .
        </span>
      </div>
    </Layout>
  );
}

export function SignupPage() {
  return (
    <Layout>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
        <p className="text-sm text-gray-600 mt-1">Start editing documents in real-time</p>
      </div>
      <SignupForm />
      <div className="mt-4 text-center">
        <span className="text-sm font-medium text-gray-900">
          I already have an account (
          <Link to="/login" className="text-blue-600 hover:underline">
            go to login
          </Link>
          ).
        </span>
      </div>
    </Layout>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md border border-gray-200">
        {children}
      </div>
    </div>
  );
}
