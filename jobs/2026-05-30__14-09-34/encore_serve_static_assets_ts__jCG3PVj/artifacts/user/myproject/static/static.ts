import { api } from "encore.dev/api";

// Serve static assets from the ./public directory at the root path.
// https://encore.dev/docs/ts/primitives/static-assets
export const assets = api.static({
  expose: true,
  path: "/!path",
  dir: "./public",
});