import { LoginForm } from "wasp/client/auth";

export function LoginPage() {
  return (
    <main className="container">
      <h1 className="title">Login</h1>
      <LoginForm />
    </main>
  );
}
