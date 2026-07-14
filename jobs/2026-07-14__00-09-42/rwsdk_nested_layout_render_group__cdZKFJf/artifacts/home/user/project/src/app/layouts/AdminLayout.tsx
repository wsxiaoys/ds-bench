import type { LayoutProps } from "rwsdk/router";

export const AdminLayout: React.FC<LayoutProps> = ({ children }) => (
  <div data-testid="admin-layout">
    <nav data-testid="admin-nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/users">Users</a>
      <a href="/admin/settings">Settings</a>
    </nav>
    {children}
  </div>
);
