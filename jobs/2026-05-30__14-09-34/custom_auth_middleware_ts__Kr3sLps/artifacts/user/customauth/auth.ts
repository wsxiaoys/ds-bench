import { authHandler } from "encore.dev/auth";
import { Unauthenticated } from "encore.dev/errors";

export interface AuthData {
  userID: string;
}

export const auth = authHandler<AuthData>(async (token) => {
  if (!token) {
    throw new Unauthenticated("missing authorization token");
  }

  if (token !== "secret-token") {
    throw new Unauthenticated("invalid authorization token");
  }

  return { userID: "user-123" };
});
