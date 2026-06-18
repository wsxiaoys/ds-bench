import { api } from "encore.dev/api";
import type { AuthData } from "./auth";

interface DashboardResponse {
  message: string;
}

export const dashboard = api<never, DashboardResponse>(
  { method: "GET", path: "/dashboard", auth: true },
  async (_req, ctx) => {
    const auth = ctx.auth as AuthData;
    return { message: `Welcome to the dashboard, ${auth.userID}!` };
  }
);
