import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: (data) => {
    if (typeof data.username !== "string") {
      throw new Error("Username is required.");
    }
    return data.username;
  },
});
