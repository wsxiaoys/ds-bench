import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (params): Promise<AuthData> => {
    const authHeader = params.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw APIError.unauthenticated("missing or invalid authorization header");
    }

    const token = authHeader.slice("Bearer ".length);

    if (token !== "secret-token") {
      throw APIError.unauthenticated("invalid token");
    }

    return { userID: "user-123" };
  }
);

export const gateway = new Gateway({
  authHandler: auth,
});
