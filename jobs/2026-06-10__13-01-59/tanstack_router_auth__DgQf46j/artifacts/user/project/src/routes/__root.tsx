import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { AuthContextType } from "../auth";

interface RouterContext {
  auth: AuthContextType;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
