import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data: any) => {
    const username = data.username;
    if (typeof username !== "string" || username.trim().length === 0) {
      throw new Error("Username is required");
    }
    return username.trim();
  },
});
