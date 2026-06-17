import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

interface DashboardResponse {
  message: string;
}

export const getDashboard = api(
  { method: "GET", path: "/dashboard", expose: true, auth: true },
  async (): Promise<DashboardResponse> => {
    const authData = getAuthData()!;
    return {
      message: `Welcome to the dashboard, ${authData.userID}!`,
    };
  }
);
