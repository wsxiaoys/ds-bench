import { api } from "encore.dev/api";

export interface UserParams {
  id: number;
}

export interface UserResponse {
  id: number;
  name: string;
}

// Returns a user by ID. If the ID is 1, returns "Alice", otherwise "Unknown".
export const getUser = api<UserParams, UserResponse>(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }) => {
    return {
      id,
      name: id === 1 ? "Alice" : "Unknown",
    };
  }
);