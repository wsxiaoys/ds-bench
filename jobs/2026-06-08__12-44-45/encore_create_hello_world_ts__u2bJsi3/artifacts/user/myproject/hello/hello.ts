import { api } from "encore.dev/api";

interface Response {
  message: string;
}

// Returns a personalized greeting.
export const get = api(
  { expose: true, method: "GET", path: "/hello/:name" },
  async ({ name }: { name: string }): Promise<Response> => {
    const msg = `Hello ${name}!`;
    return { message: msg };
  }
);
