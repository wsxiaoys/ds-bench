import express from "express";
import type { MiddlewareConfigFn } from "wasp/server";
import type { Status, Echo } from "wasp/server/api";

export const apiNamespaceMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set("apiNamespaceHeader", (req, res, next) => {
    res.setHeader("X-Api-Namespace", "v1");
    next();
  });
  return middlewareConfig;
};

export const echoMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  // Replace the default JSON body parser with a raw body parser
  middlewareConfig.delete("express.json");
  middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));

  // Sets the response header X-Echo: raw on that route only
  middlewareConfig.set("echoHeader", (req, res, next) => {
    res.setHeader("X-Echo", "raw");
    next();
  });

  return middlewareConfig;
};

export const status: Status = (req, res) => {
  res.json({ status: "ok" });
};

export const echo: Echo = (req, res) => {
  const byteLength = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.json({ bytes: byteLength });
};
