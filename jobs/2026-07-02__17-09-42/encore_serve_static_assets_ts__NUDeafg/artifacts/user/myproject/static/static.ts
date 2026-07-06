import { api } from "encore.dev/api";

// Making use of api.static to serve static assets from the file system.
// https://encore.dev/docs/ts/primitives/static-assets

// Using fallback route to serve all files in the ../public directory under the root path.
export const rootAssets = api.static({
  expose: true,
  path: "/!path",
  dir: "../public",
});
