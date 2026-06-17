import { api } from "encore.dev/api";

interface GreetParams {
  name: string;
}

interface GreetResponse {
  message: string;
}

export const greet = api(
  { method: "GET", path: "/greet/:name", expose: true },
  async ({ name }: GreetParams): Promise<GreetResponse> => {
    return { message: `Hello, ${name}!` };
  }
);
