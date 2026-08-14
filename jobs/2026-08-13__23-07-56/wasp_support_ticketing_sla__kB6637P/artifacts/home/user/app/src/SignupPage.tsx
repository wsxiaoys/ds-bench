import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <SignupForm />
    </div>
  );
}
