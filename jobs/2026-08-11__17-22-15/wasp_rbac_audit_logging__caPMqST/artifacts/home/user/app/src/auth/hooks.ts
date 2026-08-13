import { HttpError } from "wasp/server";
import type { OnBeforeSignupHook } from "wasp/server/auth"

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = providerId.providerUserId;
  const role = req?.body?.role;
  if (role === "ADMIN" && !username.endsWith("_admin")) {
    throw new HttpError(400, "Username must end with _admin for ADMIN role");
  }
};
