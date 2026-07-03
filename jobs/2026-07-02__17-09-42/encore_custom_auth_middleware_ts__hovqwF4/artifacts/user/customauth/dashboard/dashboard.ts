import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

// DashboardResponse is the response data for the /dashboard endpoint.
interface DashboardResponse {
    message: string;
}

// get returns a welcome message for the authenticated user.
// It requires authentication via the auth handler defined in
// auth/auth.ts (auth: true).
export const get = api(
    { expose: true, method: "GET", path: "/dashboard", auth: true },
    async (): Promise<DashboardResponse> => {
        const auth = getAuthData();
        return {
            message: `Welcome to the dashboard, ${auth.userID}!`,
        };
    }
);