import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { AuthData } from "../auth/auth";

// DashboardResponse is the JSON returned by the /dashboard endpoint.
interface DashboardResponse {
  message: string;
}

// getDashboard is a protected endpoint that requires authentication.
// It is exposed publicly at GET /dashboard and requires `auth: true`,
// so Encore's API Gateway rejects any request that is not authenticated.
export const getDashboard = api(
  { method: "GET", path: "/dashboard", expose: true, auth: true },
  async (): Promise<DashboardResponse> => {
    // The auth data is resolved by the auth handler and made available
    // here. Because the endpoint requires authentication, Encore
    // guarantees that this is present.
    const user = getAuthData<AuthData>();
    if (!user) {
      throw new Error("unauthenticated");
    }

    return { message: `Welcome to the dashboard, ${user.userID}!` };
  },
);