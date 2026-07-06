import { api } from "encore.dev/api/mod";

// Serve static files from the public directory at the root path.
export const staticAssets = api.static({
  path: "/",
  dir: "public",
  expose: true,
});
