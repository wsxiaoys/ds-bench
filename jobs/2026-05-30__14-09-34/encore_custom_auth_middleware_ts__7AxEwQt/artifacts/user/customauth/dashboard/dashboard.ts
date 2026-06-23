import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export const dashboard = api(
  { auth: true, expose: true, method: "GET", path: "/dashboard" },
  async (): Promise<{ message: string }> => {
    const authData = getAuthData<{ userID: string }>()!;
    return { message: `Welcome to the dashboard, ${authData.userID}!` };
  }
);