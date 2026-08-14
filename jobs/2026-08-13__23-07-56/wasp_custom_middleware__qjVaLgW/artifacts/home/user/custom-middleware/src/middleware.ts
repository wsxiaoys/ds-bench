import cors from "cors";
import express from "express";
import { config, type MiddlewareConfigFn } from "wasp/server";

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Extends the allowed CORS origins so requests from the local origin http://localhost:5000 are accepted,
  // while keeping the existing/default allowed origins (including the local client at http://localhost:3000) working.
  const origin = [
    ...config.allowedCORSOrigins,
    "http://localhost:5000",
  ];
  middlewareConfig.set("cors", cors({ origin }));

  // Adds a custom middleware entry that sets the response header X-Global: enabled on responses.
  middlewareConfig.set("globalHeader", (req, res, next) => {
    res.setHeader("X-Global", "enabled");
    next();
  });

  return middlewareConfig;
};

export const apiNamespaceMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Apply a per-path (namespace) middleware to everything under /api that sets the response header X-Api-Namespace: v1.
  middlewareConfig.set("apiNamespaceHeader", (req, res, next) => {
    res.setHeader("X-Api-Namespace", "v1");
    next();
  });
  return middlewareConfig;
};

export const echoMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Replaces the default JSON body parser with a raw body parser (so the handler receives the unparsed request body as raw bytes)
  middlewareConfig.delete("express.json");
  middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));

  // Sets the response header X-Echo: raw on that route only
  middlewareConfig.set("echoHeader", (req, res, next) => {
    res.setHeader("X-Echo", "raw");
    next();
  });

  return middlewareConfig;
};
