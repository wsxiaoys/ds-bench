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
