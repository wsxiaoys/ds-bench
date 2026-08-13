import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: async (data) => {
    const username = data.username;
    if (typeof username !== "string") {
      throw new Error("Username is required");
    }
    return username;
  },
});
