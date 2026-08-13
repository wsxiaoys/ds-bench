import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data: any) => {
    const username = data.username;
    if (typeof username !== "string" || !username) {
      throw new Error("Username is required");
    }
    return username;
  },
  role: async (data: any) => {
    const role = data.role;
    if (typeof role !== "string" || !role) {
      throw new Error("Role is required");
    }
    if (role !== "CUSTOMER" && role !== "AGENT" && role !== "MANAGER") {
      throw new Error("Invalid role");
    }
    return role;
  },
});
