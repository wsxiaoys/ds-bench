import type { MiddlewareConfigFn } from 'wasp/server';
/**
 * Per-path (namespace) middleware applied to every api under `/api`.
 * Sets the `X-Api-Namespace: v1` response header.
 */
export declare const apiNamespaceMiddlewareFn: MiddlewareConfigFn;
/**
 * Per-api middleware applied only to `POST /api/echo`.
 *
 * - Replaces the default JSON body parser with a raw body parser, so the
 *   handler receives the unparsed request body as a Buffer on `req.body`.
 * - Adds a custom middleware that sets the `X-Echo: raw` response header.
 */
export declare const echoMiddlewareFn: MiddlewareConfigFn;
/**
 * GET /api/status -> { "status": "ok" }
 */
export declare const getStatus: (_req: any, res: any) => void;
/**
 * POST /api/echo -> { "bytes": <byte length of raw request body> }
 *
 * Because the per-api middleware swapped the JSON parser for a raw parser,
 * `req.body` is a Buffer containing the unparsed request body.
 */
export declare const postEcho: (req: any, res: any) => void;
//# sourceMappingURL=apis.d.ts.map