import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data) => {
    if (typeof data.username !== "string") {
      throw new Error("Username is required");
    }
    return data.username;
  },
  password: async (data) => {
    // Wasp's auth handles password hashing and stores it in AuthIdentity.
    // The password field on the User model is a schema requirement.
    // If data.password is present, we return it, otherwise a placeholder.
    if (typeof data.password === "string") {
      return data.password;
    }
    return "dummy_password_hash_for_schema";
  },
  role: async (data) => {
    if (typeof data.role !== "string") {
      return "CUSTOMER";
    }
    const role = data.role.toUpperCase();
    if (role !== "CUSTOMER" && role !== "AGENT" && role !== "MANAGER") {
      throw new Error("Invalid role. Must be CUSTOMER, AGENT, or MANAGER");
    }
    return role;
  },
});
