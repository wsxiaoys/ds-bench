import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data: any) => {
    if (!data.username) {
      throw new Error("Username is required");
    }
    return data.username;
  },
  password: async (data: any) => {
    // Wasp's auth backend handles the actual password hashing and verification in the AuthIdentity table.
    // Since the User model requires a password field, we can store a placeholder or any value.
    return "password123";
  },
  role: async (data: any) => {
    return data.role || "CUSTOMER";
  },
});
