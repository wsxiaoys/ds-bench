import express from "express";
export const getStatus = (req, res) => {
    res.status(200).json({ status: "ok" });
};
export const echoHandler = (req, res) => {
    const body = req.body;
    const bytes = Buffer.isBuffer(body) ? body.length : 0;
    res.status(200).json({ bytes });
};
export const echoMiddleware = (middlewareConfig) => {
    // Replaces the default JSON body parser with a raw body parser (so the handler receives the unparsed request body as raw bytes)
    middlewareConfig.delete("express.json");
    middlewareConfig.set("express.raw", express.raw({ type: "*/*" }));
    // Sets the response header X-Echo: raw on that route only.
    middlewareConfig.set("x-echo", (req, res, next) => {
        res.setHeader("X-Echo", "raw");
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=apis.js.map