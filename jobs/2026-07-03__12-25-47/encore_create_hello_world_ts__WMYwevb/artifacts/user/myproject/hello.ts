import { api } from "encore.dev/api";

interface HelloResponse {
  message: string;
}

export const get = api<{ name: string }, HelloResponse>(
  { expose: true, method: "GET", path: "/hello/:name" },
  async ({ name }) => {
    return { message: `Hello ${name}!` };
  }
);
