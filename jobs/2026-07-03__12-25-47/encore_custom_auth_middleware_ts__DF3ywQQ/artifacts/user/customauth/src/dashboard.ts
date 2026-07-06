import { api } from "encore.dev/api";
import { getAuthData } from "../encore.gen/auth";

interface DashboardResponse {
  message: string;
}

export const getDashboard = api(
  { auth: true, method: "GET", path: "/dashboard", expose: true },
  async (): Promise<DashboardResponse> => {
    const auth = getAuthData()!;
    return {
      message: `Welcome to the dashboard, ${auth.userID}!`,
    };
  }
);
