import { api } from "encore.dev/api";

interface UserParams {
  id: number;
}

interface UserResponse {
  id: number;
  name: string;
}

export const getUser = api(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }: UserParams): Promise<UserResponse> => {
    if (id === 1) {
      return { id, name: "Alice" };
    }
    return { id, name: "Unknown" };
  }
);