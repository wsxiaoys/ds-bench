import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data: any) => {
    if (typeof data.username !== "string" || !data.username) {
      throw new Error("Username is required");
    }
    return data.username;
  },
});
