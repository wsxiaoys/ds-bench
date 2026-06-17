import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div>
      <h1>Welcome to Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
