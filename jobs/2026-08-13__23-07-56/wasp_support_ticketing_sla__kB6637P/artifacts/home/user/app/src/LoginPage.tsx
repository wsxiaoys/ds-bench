import { LoginForm } from "wasp/client/auth";

export function LoginPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <LoginForm />
    </div>
  );
}
