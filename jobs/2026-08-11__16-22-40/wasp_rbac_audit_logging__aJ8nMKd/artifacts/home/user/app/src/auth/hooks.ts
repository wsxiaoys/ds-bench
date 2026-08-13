import { HttpError } from "wasp/server";
import type { OnBeforeSignupHook } from "wasp/server/auth";

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = req.body?.username || providerId.providerUserId;
  const role = req.body?.role;

  if (role === "ADMIN" && (!username || !username.endsWith("_admin"))) {
    throw new HttpError(403, "Admin username must end with _admin");
  }
};
