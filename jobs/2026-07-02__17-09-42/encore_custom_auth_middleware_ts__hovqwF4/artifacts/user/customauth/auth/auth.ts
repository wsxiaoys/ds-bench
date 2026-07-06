import { Header, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { APIError } from "encore.dev/api";

// AuthParams specifies the incoming request information
// the auth handler is interested in. In this case it only
// cares about requests that contain the `Authorization` header.
interface AuthParams {
    authorization: Header<"Authorization">;
}

// The AuthData specifies the information about the authenticated user
// that the auth handler makes available.
interface AuthData {
    userID: string;
}

// The auth handler itself. It inspects the Authorization header
// for a Bearer token. If the token is "secret-token" it returns
// a user object with userID "user-123". Otherwise, it rejects
// the request with an Unauthenticated error.
export const auth = authHandler<AuthParams, AuthData>(
    async (params) => {
        const header = params.authorization;

        // Require the Authorization header to be present and
        // formatted as a Bearer token.
        if (!header || !header.startsWith("Bearer ")) {
            throw APIError.unauthenticated("missing or invalid authorization header");
        }

        const token = header.slice("Bearer ".length).trim();

        if (token !== "secret-token") {
            throw APIError.unauthenticated("invalid token");
        }

        return { userID: "user-123" };
    }
);

// Define the API Gateway that will execute the auth handler.
export const gateway = new Gateway({
    authHandler: auth,
});