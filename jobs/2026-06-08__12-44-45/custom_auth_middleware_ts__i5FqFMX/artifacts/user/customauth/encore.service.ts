import { Service } from "encore.dev/service";
import { api } from "encore.dev/api";
import { getAuthData } from "encore.dev/internal/codegen/auth";

interface AuthData {
  userID: string;
}

export const dashboard = api(
  { expose: true, auth: true, method: "GET", path: "/dashboard" },
  async (): Promise<{ message: string }> => {
    const data = getAuthData<AuthData>();
    return { message: `Welcome to the dashboard, \${data?.userID}!` };
  }
);

export default new Service("customauth");
