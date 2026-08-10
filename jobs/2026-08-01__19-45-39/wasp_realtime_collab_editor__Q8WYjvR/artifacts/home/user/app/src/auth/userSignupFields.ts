import { defineUserSignupFields } from "wasp/server/auth";

// Map the username sent from the client's signup form to the `username`
// field on the `User` entity.
export const userSignupFields = defineUserSignupFields({
  username: (data: unknown) => {
    const username = (data as { username?: unknown })?.username;
    if (typeof username !== "string" || username.trim().length === 0) {
      throw new Error("Username is required");
    }
    return username;
  },
});
