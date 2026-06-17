import { authHandler } from "encore.dev/auth";
import { APIError, Header } from "encore.dev/api";

interface AuthData {
  userID: string;
}

export const myAuthHandler = authHandler(async (params: { authorization: Header<string> }): Promise<AuthData> => {
  if (params.authorization === "Bearer secret-token") {
    return { userID: "user-123" };
  }
  throw APIError.unauthenticated("Invalid token");
});
