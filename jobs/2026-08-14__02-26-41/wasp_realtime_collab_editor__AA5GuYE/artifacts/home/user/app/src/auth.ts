import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: (data: any) => {
    if (typeof data.username !== "string" || !data.username.trim()) {
      throw new Error("Username is required");
    }
    return data.username.trim();
  },
});
