import type { ReactNode } from "react";
import "./Main.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">{children}</div>
    </div>
  );
}
