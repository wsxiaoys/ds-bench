import { HttpError } from "wasp/server";
import type { OnBeforeSignupHook } from "wasp/server/auth";

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = providerId?.providerUserId || req.body?.username;
  const role = req.body?.role;

  if (role === "ADMIN" && (!username || !username.endsWith("_admin"))) {
    throw new HttpError(400, "Admin signup requires username to end with _admin");
  }
};
