import React from "react";
import { LoginForm, SignupForm, FormItemGroup, FormLabel, FormError } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <Layout>
      <LoginForm />
      <br />
      <span className="text-sm font-medium text-gray-900">
        Don't have an account yet? <Link to="/signup">go to signup</Link>.
      </span>
    </Layout>
  );
}

export function SignupPage() {
  return (
    <Layout>
      <SignupForm
        additionalFields={[
          (form: any, state: any) => {
            return (
              <FormItemGroup key="role">
                <FormLabel>Role</FormLabel>
                <select
                  {...form.register("role", {
                    required: "Role is required",
                  })}
                  disabled={state.isLoading}
                  style={{
                    width: "100%",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    padding: "8px",
                    marginTop: "4px"
                  }}
                >
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="AGENT">AGENT</option>
                  <option value="MANAGER">MANAGER</option>
                </select>
                {form.formState.errors.role && (
                  <FormError>
                    {form.formState.errors.role.message}
                  </FormError>
                )}
              </FormItemGroup>
            );
          }
        ]}
      />
      <br />
      <span className="text-sm font-medium text-gray-900">
        I already have an account (<Link to="/login">go to login</Link>).
      </span>
    </Layout>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
      <div style={{ width: "100%", maxWidth: "400px", backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {children}
      </div>
    </div>
  );
}
