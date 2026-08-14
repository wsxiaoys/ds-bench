import type { OnBeforeSignupHook } from "wasp/server/auth";
import { HttpError } from "wasp/server";

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = req.body?.username || providerId.providerUserId;
  const role = req.body?.role;

  if (role === "ADMIN" && (!username || !username.endsWith("_admin"))) {
    throw new HttpError(400, "Admin signup requires username to end with _admin");
  }
};
