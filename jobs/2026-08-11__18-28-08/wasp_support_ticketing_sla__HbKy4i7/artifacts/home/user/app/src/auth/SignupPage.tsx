import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Create a new account</h2>
        <SignupForm
          additionalFields={[
            (form: any, state: any) => {
              return (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "#374151", marginBottom: "0.25rem" }}>
                    Role
                  </label>
                  <select
                    {...form.register("role", { required: "Role is required" })}
                    disabled={state.isLoading}
                    style={{
                      width: "100%",
                      borderRadius: "0.375rem",
                      border: "1px solid #d1d5db",
                      padding: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#111827",
                    }}
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="AGENT">AGENT</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>
              );
            }
          ]}
        />
        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
