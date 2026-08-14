import express from "express";
import cors from "cors";
import { config } from "wasp/server";
export const globalMiddleware = (middlewareConfig) => {
    // Extends the allowed CORS origins so requests from the local origin http://localhost:5000 are accepted,
    // while keeping the existing/default allowed origins (including the local client at http://localhost:3000) working.
    const origin = [
        ...config.allowedCORSOrigins,
        "http://localhost:5000",
    ];
    middlewareConfig.set("cors", cors({ origin }));
    // Adds a custom middleware entry that sets the response header X-Global: enabled on responses.
    const xGlobalMiddleware = (_req, res, next) => {
        res.setHeader("X-Global", "enabled");
        next();
    };
    middlewareConfig.set("x-global", xGlobalMiddleware);
    return middlewareConfig;
};
export const apiNamespaceMiddleware = (middlewareConfig) => {
    // Apply a per-path (namespace) middleware to everything under /api that sets the response header X-Api-Namespace: v1.
    const xApiNamespaceMiddleware = (_req, res, next) => {
        res.setHeader("X-Api-Namespace", "v1");
        next();
    };
    middlewareConfig.set("x-api-namespace", xApiNamespaceMiddleware);
    return middlewareConfig;
};
export const echoMiddleware = (middlewareConfig) => {
    // Give one endpoint a per-api middleware that replaces the default JSON body parser with a raw body parser
    // (so the handler receives the unparsed request body as raw bytes) and also sets the response header X-Echo: raw on that route only.
    middlewareConfig.delete("express.json");
    middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));
    const xEchoMiddleware = (_req, res, next) => {
        res.setHeader("X-Echo", "raw");
        next();
    };
    middlewareConfig.set("x-echo", xEchoMiddleware);
    return middlewareConfig;
};
//# sourceMappingURL=middleware.js.map