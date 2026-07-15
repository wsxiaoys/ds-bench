import express from 'express';
/**
 * GET /api/status
 *
 * Responds with status 200 and JSON body { "status": "ok" }.
 */
export const getStatus = (_req, res, _context) => {
    res.status(200).json({ status: 'ok' });
};
/**
 * POST /api/echo
 *
 * Its route middleware parses the body as raw bytes (express.raw), so
 * `req.body` is a Buffer. Responds with status 200 and JSON body
 * { "bytes": <number> } where <number> is the exact byte length of the
 * raw request body.
 */
export const echo = (req, res, _context) => {
    const body = req.body;
    const bytes = Buffer.isBuffer(body) ? body.length : 0;
    res.status(200).json({ bytes });
};
/**
 * Per-path (namespace) middleware applied to everything under /api.
 *
 * Sets the response header X-Api-Namespace: v1 on every /api/* response.
 */
export const apiNamespaceMiddlewareFn = (middlewareConfig) => {
    middlewareConfig.set('apiNamespaceHeader', (_req, res, next) => {
        res.setHeader('X-Api-Namespace', 'v1');
        next();
    });
    return middlewareConfig;
};
/**
 * Per-api middleware for the POST /api/echo route only.
 *
 * Replaces the default JSON body parser with a raw body parser (so the
 * handler receives the unparsed request body as raw bytes) and sets the
 * response header X-Echo: raw on that route only.
 */
export const echoMiddlewareFn = (middlewareConfig) => {
    // Replace the default JSON body parser with a raw body parser.
    middlewareConfig.delete('express.json');
    middlewareConfig.set('express.raw', express.raw({ type: '*/*' }));
    // Set the X-Echo: raw header on this route only.
    middlewareConfig.set('echoHeader', (_req, res, next) => {
        res.setHeader('X-Echo', 'raw');
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=apis.js.map