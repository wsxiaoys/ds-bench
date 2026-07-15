import type { MiddlewareConfigFn } from 'wasp/server';
/**
 * Global server middleware.
 *
 * - Extends the allowed CORS origins to include http://localhost:5000 while
 *   preserving the existing default origins (e.g. http://localhost:3000).
 * - Adds a custom middleware that sets the `X-Global: enabled` response header.
 */
export declare const serverMiddlewareFn: MiddlewareConfigFn;
