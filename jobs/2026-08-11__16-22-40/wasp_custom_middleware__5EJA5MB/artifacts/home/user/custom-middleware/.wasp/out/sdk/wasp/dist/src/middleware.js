import express from "express";
import cors from "cors";
import { config } from "wasp/server";
export const serverMiddlewareFn = (middlewareConfig) => {
    // Extends the allowed CORS origins so requests from the local origin http://localhost:5000 are accepted,
    // while keeping the existing/default allowed origins (including the local client at http://localhost:3000) working.
    const origin = [
        ...config.allowedCORSOrigins,
        "http://localhost:5000",
    ];
    middlewareConfig.set("cors", cors({ origin }));
    // Adds a custom middleware entry that sets the response header X-Global: enabled on responses.
    middlewareConfig.set("x-global", (req, res, next) => {
        res.set("X-Global", "enabled");
        next();
    });
    return middlewareConfig;
};
export const apiNamespaceMiddlewareFn = (middlewareConfig) => {
    // Sets the response header X-Api-Namespace: v1
    middlewareConfig.set("x-api-namespace", (req, res, next) => {
        res.set("X-Api-Namespace", "v1");
        next();
    });
    return middlewareConfig;
};
export const echoMiddlewareFn = (middlewareConfig) => {
    // Replaces the default JSON body parser with a raw body parser
    middlewareConfig.set("express.json", express.raw({ type: "*/*" }));
    // Sets the response header X-Echo: raw on that route only
    middlewareConfig.set("x-echo", (req, res, next) => {
        res.set("X-Echo", "raw");
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=middleware.js.map