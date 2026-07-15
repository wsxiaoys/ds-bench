import cors from "cors";
import { config } from "wasp/server";
export const serverMiddlewareFn = (middlewareConfig) => {
    // Extends the allowed CORS origins so requests from the local origin http://localhost:5000 are accepted,
    // while keeping the existing/default allowed origins (including the local client at http://localhost:3000) working.
    middlewareConfig.set("cors", cors({ origin: [...config.allowedCORSOrigins, "http://localhost:5000"] }));
    // Adds a custom middleware entry that sets the response header X-Global: enabled on responses.
    middlewareConfig.set("x-global", (req, res, next) => {
        res.setHeader("X-Global", "enabled");
        next();
    });
    return middlewareConfig;
};
export const apiNamespaceMiddleware = (middlewareConfig) => {
    // Apply a per-path (namespace) middleware to everything under /api that sets the response header X-Api-Namespace: v1.
    middlewareConfig.set("x-api-namespace", (req, res, next) => {
        res.setHeader("X-Api-Namespace", "v1");
        next();
    });
    return middlewareConfig;
};
