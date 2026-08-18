import { Link } from "react-router";
import { LoginForm } from "wasp/client/auth";

export const LoginPage = () => {
  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <LoginForm />
      <br />
      <span>
        I don't have an account yet (<Link to="/signup">go to signup</Link>).
      </span>
    </div>
  );
};
