import { LoginForm, SignupForm, FormItemGroup, FormLabel, FormError } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <LoginForm />
        <p className="mt-2 text-center text-sm text-gray-600">
          Don't have an account yet?{" "}
          <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <SignupForm
          additionalFields={[
            (form: any, state: any) => {
              return (
                <FormItemGroup key="role-group">
                  <FormLabel>Role</FormLabel>
                  <select
                    id="signup-role"
                    data-testid="signup-role"
                    {...form.register("role", { required: "Role is required" })}
                    disabled={state.isLoading}
                    className="w-full rounded border border-gray-300 p-2"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="AGENT">Agent</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                  {form.formState.errors.role && (
                    <FormError>{form.formState.errors.role.message as string}</FormError>
                  )}
                </FormItemGroup>
              );
            }
          ]}
        />
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
