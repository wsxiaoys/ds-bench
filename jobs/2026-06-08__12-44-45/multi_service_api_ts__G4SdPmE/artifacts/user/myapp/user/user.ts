import { api } from "encore.dev/api";

export const getUser = api(
  { expose: true, method: "GET", path: "/user/:id" },
  async ({ id }: { id: number }): Promise<{ id: number; name: string }> => {
    const name = id === 1 ? "Alice" : "Unknown";
    return { id, name };
  }
);
