import express from "express";
// Per-path (namespace) middleware applied to everything under "/api".
// Sets the `X-Api-Namespace` response header on every response under that path.
export const apiNamespaceMiddlewareFn = (middlewareConfig) => {
    // Don't eagerly parse the body (as JSON or urlencoded) at the namespace
    // level: doing so would consume the request stream before any per-api
    // middleware (e.g. the raw body parser used by /api/echo) gets a chance to
    // run.
    middlewareConfig.delete("express.json");
    middlewareConfig.delete("express.urlencoded");
    middlewareConfig.set("api-namespace.custom", (_req, res, next) => {
        res.set("X-Api-Namespace", "v1");
        next();
    });
    return middlewareConfig;
};
// GET /api/status
export const apiStatus = (_req, res, _context) => {
    res.status(200).json({ status: "ok" });
};
// POST /api/echo
// Relies on the express.raw() body parser (installed by apiEchoMiddlewareFn)
// so that `req.body` is the raw, unparsed request body (a Buffer).
export const apiEcho = (req, res, _context) => {
    const body = req.body;
    const bytes = Buffer.isBuffer(body)
        ? body.length
        : Buffer.byteLength(body ?? "");
    res.status(200).json({ bytes });
};
// Per-api middleware for the /api/echo route.
// - Replaces the default JSON body parser with a raw body parser so the
//   handler receives the unparsed request body as raw bytes.
// - Sets the `X-Echo` response header, only on this route.
export const apiEchoMiddlewareFn = (middlewareConfig) => {
    middlewareConfig.delete("express.json");
    middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));
    middlewareConfig.set("echo.custom", (_req, res, next) => {
        res.set("X-Echo", "raw");
        next();
    });
    return middlewareConfig;
};
