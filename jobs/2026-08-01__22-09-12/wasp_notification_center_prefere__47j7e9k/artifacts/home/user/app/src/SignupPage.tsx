import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <main className="container">
      <h1 className="title">Sign Up</h1>
      <SignupForm />
    </main>
  );
}
