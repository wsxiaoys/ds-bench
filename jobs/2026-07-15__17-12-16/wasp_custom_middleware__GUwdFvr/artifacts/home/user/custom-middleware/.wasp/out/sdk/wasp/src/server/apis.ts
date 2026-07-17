import express from "express"
import { type MiddlewareConfigFn } from "wasp/server"
import { type Status, type Echo } from "wasp/server/api"

export const getStatus: Status = (req, res) => {
  res.status(200).json({ status: "ok" });
}

export const echoHandler: Echo = (req, res) => {
  const body = req.body;
  console.log("echoHandler: body =", body, "isBuffer =", Buffer.isBuffer(body));
  const bytes = Buffer.isBuffer(body) ? body.length : 0;
  res.status(200).json({ bytes });
}

export const echoMiddleware: MiddlewareConfigFn = (middlewareConfig) => {
  // Replaces the default JSON body parser with a raw body parser (so the handler receives the unparsed request body as raw bytes)
  middlewareConfig.delete("express.json");
  middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));
  
  // Sets the response header X-Echo: raw on that route only.
  middlewareConfig.set("x-echo", (req, res, next) => {
    res.setHeader("X-Echo", "raw");
    next();
  });
  
  return middlewareConfig;
}
