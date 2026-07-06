import { authHandler } from "encore.dev/auth";
import { APIError, Header } from "encore.dev/api";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

export const myAuth = authHandler<AuthParams, AuthData>(
  async (params) => {
    const authHeader = params.authorization;
    if (!authHeader) {
      throw APIError.unauthenticated("missing authorization header");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === "") {
      throw APIError.unauthenticated("missing bearer token");
    }

    if (token !== "secret-token") {
      throw APIError.unauthenticated("invalid token");
    }

    return {
      userID: "user-123",
    };
  }
);
