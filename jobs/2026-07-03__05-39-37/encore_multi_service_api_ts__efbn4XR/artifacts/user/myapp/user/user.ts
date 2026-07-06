import { api } from "encore.dev/api";

export interface User {
  id: number;
  name: string;
}

// getUser returns a user by ID.
// For ID 1 it returns "Alice", otherwise "Unknown".
export const getUser = api(
  { method: "GET", path: "/user/:id", expose: true },
  async (params: { id: number }): Promise<User> => {
    const name = params.id === 1 ? "Alice" : "Unknown";
    return { id: params.id, name };
  }
);