import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

interface DashboardResponse {
  message: string;
}

export const getDashboard = api(
  { expose: true, method: "GET", path: "/dashboard", auth: true },
  async (): Promise<DashboardResponse> => {
    const authData = getAuthData();
    return { message: `Welcome to the dashboard, ${authData!.userID}!` };
  }
);
