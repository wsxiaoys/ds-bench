import { api } from "encore.dev/api";

interface User {
  id: number;
  name: string;
}

export const getUser = api(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }: { id: number }): Promise<User> => {
    const name = id === 1 ? "Alice" : "Unknown";
    return { id, name };
  }
);
