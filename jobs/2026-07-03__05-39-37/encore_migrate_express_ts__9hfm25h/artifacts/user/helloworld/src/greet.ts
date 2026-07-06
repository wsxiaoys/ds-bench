import { api } from "encore.dev/api";

interface GreetParams {
  name: string;
}

interface GreetResponse {
  message: string;
}

export const greet = api(
  { method: "GET", path: "/greet/:name" },
  async (params: GreetParams): Promise<GreetResponse> => {
    return { message: `Hello, ${params.name}!` };
  }
);