import { api } from "encore.dev/api";

interface User {
  id: number;
  name: string;
}

export const getUser = api(
  { method: "GET", path: "/user/:id" },
  async ({ id }: { id: number }): Promise<User> => {
    return { id, name: id === 1 ? "Alice" : "Unknown" };
  }
);
