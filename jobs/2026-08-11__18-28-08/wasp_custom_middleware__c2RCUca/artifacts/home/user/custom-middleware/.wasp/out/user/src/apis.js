import express from "express";
export const apiNamespaceMiddleware = (middlewareConfig) => {
    middlewareConfig.set("apiNamespaceHeader", (req, res, next) => {
        res.setHeader("X-Api-Namespace", "v1");
        next();
    });
    return middlewareConfig;
};
export const echoMiddleware = (middlewareConfig) => {
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
export const status = (req, res) => {
    res.json({ status: "ok" });
};
export const echo = (req, res) => {
    const byteLength = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.json({ bytes: byteLength });
};
