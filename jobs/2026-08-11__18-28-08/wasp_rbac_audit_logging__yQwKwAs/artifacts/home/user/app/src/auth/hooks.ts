import { HttpError } from "wasp/server";
import { defineUserSignupFields } from "wasp/server/auth";
import type { OnBeforeSignupHook } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  role: (data: any) => {
    const role = data.role;
    if (role === "ANALYST" || role === "MANAGER" || role === "ADMIN") {
      return role;
    }
    return "ANALYST";
  },
});

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = req.body?.username;
  const role = req.body?.role;

  if (role === "ADMIN" && (!username || !username.endsWith("_admin"))) {
    throw new HttpError(400, "Admin signup requires username to end with _admin");
  }
};
