import api from "encore.dev/api";

// Serve static assets from the public directory at the root path.
// This makes /index.html and /style.css accessible at the root of the application.
export const staticAssets = api.static({
    dir: "./public",
    path: "/",
    expose: true,
});