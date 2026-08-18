import { useState } from "react";
import { signup } from "wasp/client/auth";
import { Link, useNavigate } from "react-router";

const RUN_ID = "zrwuzpzyd7";

function suffixUsername(username: string) {
  if (username.endsWith(`-${RUN_ID}`)) return username;
  return `${username}-${RUN_ID}`;
}

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const suffixedUser = suffixUsername(username);
      await signup({ username: suffixedUser, password });
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "An error occurred during signup");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-lg shadow" style={{ maxWidth: "400px", margin: "100px auto" }}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" style={{ color: "red", marginBottom: "10px" }}>
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <input
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "15px" }}>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              style={{ width: "100%", padding: "10px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Sign up
            </button>
          </div>
        </form>
        <div className="text-center text-sm" style={{ marginTop: "15px", textAlign: "center" }}>
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500" style={{ color: "#2563eb", textDecoration: "none" }}>
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
