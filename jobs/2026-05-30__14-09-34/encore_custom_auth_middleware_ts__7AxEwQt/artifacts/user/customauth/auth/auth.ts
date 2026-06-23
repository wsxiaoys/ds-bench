import { authHandler } from "encore.dev/auth";
import { Header, Gateway } from "encore.dev/api";

interface AuthData {
  userID: string;
}

interface AuthParams {
  authorization: Header<"Authorization">;
}

const handler = authHandler<AuthParams, AuthData>(async (params) => {
  const authHeader = params.authorization;
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1];
  if (token !== "secret-token") {
    return null;
  }

  return { userID: "user-123" };
});

export default handler;

export const gateway = new Gateway({
  authHandler: handler,
});