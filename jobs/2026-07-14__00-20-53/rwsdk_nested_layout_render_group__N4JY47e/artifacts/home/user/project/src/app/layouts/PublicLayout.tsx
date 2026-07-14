import type { LayoutProps } from "rwsdk/router";

export const PublicLayout: React.FC<LayoutProps> = ({ children }) => (
  <div data-testid="public-layout">
    <nav data-testid="public-nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
    <main>{children}</main>
  </div>
);