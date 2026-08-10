import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  role: (data) => {
    const role = data.role;
    const validRoles = ["ANALYST", "MANAGER", "ADMIN"];
    if (typeof role !== "string" || !validRoles.includes(role)) {
      return "ANALYST";
    }
    return role;
  },
});
