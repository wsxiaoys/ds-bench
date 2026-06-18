export const Dashboard = ({ username }: { username: string }) => {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {username}!</p>
      <form method="post" action="/logout">
        <button type="submit">Logout</button>
      </form>
    </div>
  );
};
