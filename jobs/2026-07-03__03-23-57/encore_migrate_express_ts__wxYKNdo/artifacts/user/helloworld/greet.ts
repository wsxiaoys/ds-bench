import { api } from "encore.dev/api";

interface GreetResponse {
  message: string;
}

export const greet = api(
  { expose: true, method: "GET", path: "/greet/:name" },
  async ({ name }: { name: string }): Promise<GreetResponse> => {
    return { message: `Hello, ${name}!` };
  }
);
