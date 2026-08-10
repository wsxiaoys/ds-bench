import { HttpError } from "wasp/server";
import type { OnBeforeSignupHook } from "wasp/server/auth";

/**
 * Enforces that any user signing up with the "ADMIN" role must use a
 * username that ends with "_admin" (e.g. "super_admin").
 */
export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  req,
}) => {
  const body = (req.body ?? {}) as { role?: unknown };
  const requestedRole = body.role;

  if (requestedRole === "ADMIN") {
    const username = providerId.providerUserId;
    if (!username.endsWith("_admin")) {
      throw new HttpError(
        403,
        "Usernames for the ADMIN role must end with '_admin' (e.g. 'super_admin').",
      );
    }
  }
};
