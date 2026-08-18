import React from "react";
import { LayoutProps } from "rwsdk/router";

export const PublicLayout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div data-testid="public-layout">
      <nav data-testid="public-nav">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      {children}
    </div>
  );
};

export const AdminLayout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div data-testid="admin-layout">
      <nav data-testid="admin-nav">
        <a href="/admin">Dashboard</a>
        <a href="/admin/users">Users</a>
        <a href="/admin/settings">Settings</a>
      </nav>
      {children}
    </div>
  );
};
