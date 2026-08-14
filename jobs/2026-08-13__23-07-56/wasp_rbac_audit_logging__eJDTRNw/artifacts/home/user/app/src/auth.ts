import { HttpError } from "wasp/server";
import { defineUserSignupFields } from "wasp/server/auth";
import type { OnBeforeSignupHook } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  role: (data) => {
    const validRoles = ["ANALYST", "MANAGER", "ADMIN"];
    if (typeof data.role === "string" && validRoles.includes(data.role)) {
      return data.role;
    }
    return "ANALYST";
  },
});

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  const username = providerId.providerUserId;
  const role = req.body?.role;

  if (role === "ADMIN") {
    if (!username || !username.endsWith("_admin")) {
      throw new HttpError(
        400,
        "Users signing up with the ADMIN role must have a username ending with _admin"
      );
    }
  }
};
