import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data: any) => {
    if (!data.username) {
      throw new Error("Username is required");
    }
    return data.username;
  },
  password: async (data: any) => {
    // Standard password field is handled by Wasp's auth backend.
    // In order to populate the password field on the User model, we'll store a dummy or plain password if provided.
    return data.password || "password123";
  },
  role: async (data: any) => {
    return data.role || "CUSTOMER";
  }
});
