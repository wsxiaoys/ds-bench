export const Login = ({ error }: { error?: string }) => {
  return (
    <div>
      <h1>Login</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form method="post" action="/login">
        <label>
          Username:
          <input type="text" name="username" />
        </label>
        <br />
        <label>
          Password:
          <input type="password" name="password" />
        </label>
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};
