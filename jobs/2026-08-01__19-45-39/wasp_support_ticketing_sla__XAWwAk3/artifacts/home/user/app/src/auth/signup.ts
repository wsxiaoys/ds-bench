import { defineUserSignupFields } from "wasp/server/auth";

// Extra fields that get saved onto the `User` entity when a user signs up
// using the username & password auth method.
//
// Note: we deliberately don't include `password` here - Wasp's auth backend
// handles hashing and storing the password in the `AuthIdentity` entity, and
// including `password` here would risk saving it as plain text.
export const userSignupFields = defineUserSignupFields({
  username: (data) => {
    if (typeof data.username !== "string" || data.username.length === 0) {
      throw new Error("username is required");
    }
    return data.username;
  },
  // Anyone who signs up through the public signup form becomes a customer.
  // Agents and managers are created via the database seed.
  role: () => "CUSTOMER",
});
