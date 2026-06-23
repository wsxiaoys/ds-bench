import { api } from "encore.dev/api";

// Serve static files from the "public" directory.
export const assets = api.static({
    path: "/*path",
    dir: "./public",
    expose: true,
});
