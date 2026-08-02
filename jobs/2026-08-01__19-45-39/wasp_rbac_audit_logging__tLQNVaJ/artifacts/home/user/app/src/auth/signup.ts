import { defineUserSignupFields } from "wasp/server/auth";

const VALID_ROLES = ["ANALYST", "MANAGER", "ADMIN"] as const;
type Role = (typeof VALID_ROLES)[number];

function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export const userSignupFields = defineUserSignupFields({
  role: (data: Record<string, unknown>) => {
    const role = data.role;
    return isValidRole(role) ? role : "ANALYST";
  },
});
