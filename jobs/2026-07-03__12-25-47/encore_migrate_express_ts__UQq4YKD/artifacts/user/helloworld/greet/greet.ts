import { api } from "encore.dev/api";

interface GreetParams {
  name: string;
}

interface GreetResponse {
  message: string;
}

export const get = api<GreetParams, GreetResponse>(
  { method: "GET", path: "/greet/:name", expose: true },
  async ({ name }) => {
    return { message: `Hello, ${name}!` };
  }
);
