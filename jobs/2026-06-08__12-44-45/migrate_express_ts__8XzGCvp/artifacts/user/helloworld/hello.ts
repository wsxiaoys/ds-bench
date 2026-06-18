import { api } from "encore.dev/api";

export const greet = api(
  { method: "GET", path: "/greet/:name", expose: true },
  async ({ name }: { name: string }): Promise<{ message: string }> => {
    return { message: `Hello, ${name}!` };
  }
);
