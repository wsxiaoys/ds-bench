import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  role: (data: any) => {
    const role = data.role;
    if (role === "ANALYST" || role === "MANAGER" || role === "ADMIN") {
      return role;
    }
    return "ANALYST";
  },
});
