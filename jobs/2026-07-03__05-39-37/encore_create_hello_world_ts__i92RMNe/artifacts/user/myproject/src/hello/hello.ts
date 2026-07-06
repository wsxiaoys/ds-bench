import { api, Gateway } from "encore.dev/api";

// Returns a greeting for the given name.
export const get = api(
  { method: "GET", path: "/hello/:name" },
  async (params: { name: string }): Promise<{ message: string }> => {
    return { message: `Hello ${params.name}!` };
  }
);