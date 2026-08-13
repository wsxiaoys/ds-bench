import { Link } from "react-router";
import { SignupForm } from "wasp/client/auth";

export const SignupPage = () => {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <SignupForm />
      <br />
      <span>
        I already have an account (<Link to="/login">go to login</Link>).
      </span>
    </div>
  );
};
