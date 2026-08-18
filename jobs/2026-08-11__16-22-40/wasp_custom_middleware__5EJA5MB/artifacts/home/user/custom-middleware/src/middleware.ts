import express from "express";
import cors from "cors";
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
  middlewareConfig.set("x-global", (req, res, next) => {
    res.set("X-Global", "enabled");
    next();
  });

  // Since express.json is global, we must bypass it for /api/echo so the route-specific raw parser can parse it.
  const originalJson = middlewareConfig.get("express.json");
  if (originalJson) {
    middlewareConfig.set("express.json", (req, res, next) => {
      if (req.originalUrl === "/api/echo" || req.path === "/api/echo") {
        return next();
      }
      return originalJson(req, res, next);
    });
  }

  const originalUrlencoded = middlewareConfig.get("express.urlencoded");
  if (originalUrlencoded) {
    middlewareConfig.set("express.urlencoded", (req, res, next) => {
      if (req.originalUrl === "/api/echo" || req.path === "/api/echo") {
        return next();
      }
      return originalUrlencoded(req, res, next);
    });
  }

  return middlewareConfig;
};

export const apiNamespaceMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Sets the response header X-Api-Namespace: v1
  middlewareConfig.set("x-api-namespace", (req, res, next) => {
    res.set("X-Api-Namespace", "v1");
    next();
  });
  return middlewareConfig;
};

export const echoMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Replaces the default JSON body parser with a raw body parser
  middlewareConfig.set("express.json", express.raw({ type: "*/*" }));

  // Sets the response header X-Echo: raw on that route only
  middlewareConfig.set("x-echo", (req, res, next) => {
    res.set("X-Echo", "raw");
    next();
  });

  return middlewareConfig;
};
