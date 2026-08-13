import express from "express";
import cors from "cors";
import { config } from "wasp/server";
export const globalMiddleware = (middlewareConfig) => {
    // Extend allowed CORS origins
    const origin = [...config.allowedCORSOrigins, "http://localhost:5000"];
    middlewareConfig.set("cors", cors({ origin }));
    // Add custom middleware entry for X-Global header
    middlewareConfig.set("x-global", (req, res, next) => {
        res.setHeader("X-Global", "enabled");
        next();
    });
    return middlewareConfig;
};
export const apiNamespaceMiddleware = (middlewareConfig) => {
    // Add custom middleware entry for X-Api-Namespace header
    middlewareConfig.set("x-api-namespace", (req, res, next) => {
        res.setHeader("X-Api-Namespace", "v1");
        next();
    });
    return middlewareConfig;
};
export const echoMiddleware = (middlewareConfig) => {
    // Replaces default JSON body parser with raw body parser
    middlewareConfig.delete("express.json");
    middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));
    // Sets response header X-Echo: raw
    middlewareConfig.set("x-echo", (req, res, next) => {
        res.setHeader("X-Echo", "raw");
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=middleware.js.map