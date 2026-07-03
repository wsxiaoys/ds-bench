import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const header = params.authorization;
  if (!header) {
    throw APIError.unauthenticated("missing authorization header");
  }
  if (!header.startsWith("Bearer ")) {
    throw APIError.unauthenticated("invalid authorization header format");
  }
  const token = header.slice(7);
  if (token !== "secret-token") {
    throw APIError.unauthenticated("invalid token");
  }
  return { userID: "user-123" };
});

export const gateway = new Gateway({
  authHandler: auth,
});
