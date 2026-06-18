import { api } from "encore.dev/api";

// Serve static assets from the public directory.
export const assets = api.static(
  { expose: true, path: "/*path", dir: "./public" },
);
