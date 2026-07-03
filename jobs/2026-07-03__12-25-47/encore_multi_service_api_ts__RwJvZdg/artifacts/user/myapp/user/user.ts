import { api } from "encore.dev/api";

interface UserResponse {
  id: number;
  name: string;
}

export const get = api(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }: { id: number }): Promise<UserResponse> => {
    if (id === 1) {
      return { id, name: "Alice" };
    }
    return { id, name: "Unknown" };
  }
);
