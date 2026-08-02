import type { OnBeforeSignupHook } from "wasp/server/auth";

export const onBeforeSignup: OnBeforeSignupHook = async ({
  providerId,
  prisma,
  req,
}) => {
  // For usernameAndPassword auth, the providerUserId is the username
  const username = providerId.providerUserId;

  // Check if the user is trying to sign up with ADMIN role
  // We need to check the request body for the role field
  if (req.body) {
    const role = req.body.role;
    if (role === "ADMIN") {
      if (!username.endsWith("_admin")) {
        throw new Error(
          "Users signing up with ADMIN role must have a username ending with '_admin'"
        );
      }
    }
  }
};
