import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";

// AuthParams specifies the incoming request information the auth handler
// is interested in. Here it only cares about the `Authorization` header.
interface AuthParams {
  authorization: Header<"Authorization">;
}

// AuthData specifies the information about the authenticated user that
// the auth handler makes available to the rest of the application.
export interface AuthData {
  userID: string;
}

// The valid bearer token accepted by this auth handler.
const VALID_TOKEN = "secret-token";

// The auth handler itself. It inspects the `Authorization` header for a
// Bearer token. When the token equals "secret-token" the request is
// authenticated as user "user-123". Otherwise the request is rejected.
export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const header = params.authorization;
  if (!header) {
    throw APIError.unauthenticated("missing authorization header");
  }

  // Expected format: "Bearer <token>"
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw APIError.unauthenticated("invalid authorization header format");
  }

  const token = match[1];
  if (token !== VALID_TOKEN) {
    throw APIError.unauthenticated("invalid token");
  }

  return { userID: "user-123" };
});

// Define the API Gateway that will execute the auth handler for every
// incoming request that carries authentication parameters.
export const gateway = new Gateway({
  authHandler: auth,
});