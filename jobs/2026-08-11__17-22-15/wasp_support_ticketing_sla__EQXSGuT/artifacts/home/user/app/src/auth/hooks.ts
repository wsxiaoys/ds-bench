import type { OnAfterSignupHook } from "wasp/server/auth";

export const onAfterSignup: OnAfterSignupHook = async ({
  providerId,
  user,
  prisma,
  req,
}) => {
  const password = req.body?.password;
  if (password) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: password },
    });
  }
};
