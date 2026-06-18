import { Header, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { APIError } from "encore.dev/api";

interface AuthParams {
  authorization?: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (params) => {
    if (!params.authorization) {
      throw APIError.unauthenticated("missing authorization header");
    }
    
    const token = params.authorization.replace(/^Bearer\s+/i, "");
    if (token === "secret-token") {
      return { userID: "user-123" };
    }
    
    throw APIError.unauthenticated("invalid token");
  }
);

export const gateway = new Gateway({
  authHandler: auth,
});
