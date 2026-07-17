/**
 * GET /api/status
 *
 * Responds with status 200 and JSON body { "status": "ok" }.
 */
export declare const getStatus: (_req: any, res: any, _context: any) => void;
/**
 * POST /api/echo
 *
 * Its route middleware parses the body as raw bytes (express.raw), so
 * `req.body` is a Buffer. Responds with status 200 and JSON body
 * { "bytes": <number> } where <number> is the exact byte length of the
 * raw request body.
 */
export declare const echo: (req: any, res: any, _context: any) => void;
/**
 * Per-path (namespace) middleware applied to everything under /api.
 *
 * Sets the response header X-Api-Namespace: v1 on every /api/* response.
 */
export declare const apiNamespaceMiddlewareFn: (middlewareConfig: Map<string, any>) => Map<string, any>;
/**
 * Per-api middleware for the POST /api/echo route only.
 *
 * Replaces the default JSON body parser with a raw body parser (so the
 * handler receives the unparsed request body as raw bytes) and sets the
 * response header X-Echo: raw on that route only.
 */
export declare const echoMiddlewareFn: (middlewareConfig: Map<string, any>) => Map<string, any>;
//# sourceMappingURL=apis.d.ts.map