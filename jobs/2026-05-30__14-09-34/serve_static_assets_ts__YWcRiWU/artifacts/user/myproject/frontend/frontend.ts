import { api } from "encore.dev/api";

export const assets = api.static({
    expose: true,
    path: "/!path",
    dir: "./public",
});

export const ping = api(
  { expose: true, method: "GET", path: "/ping" },
  async (): Promise<{ message: string }> => {
    return { message: "pong" };
  }
);
// dummy
