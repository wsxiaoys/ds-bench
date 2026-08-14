import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2 style={{ textAlign: "center" }}>Sign Up</h2>
      <SignupForm
        additionalFields={[
          {
            name: "role",
            label: "Role (CUSTOMER, AGENT, or MANAGER)",
            type: "input",
            validations: {
              required: "Role is required",
            },
          },
        ]}
      />
      <p style={{ marginTop: "20px", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in here</Link>
      </p>
    </div>
  );
}
