import cors from 'cors';
import type { MiddlewareConfigFn } from 'wasp/server';
import { config } from 'wasp/server';

/**
 * Global server middleware.
 *
 * - Extends the allowed CORS origins to include http://localhost:5000 while
 *   preserving the existing default origins (e.g. http://localhost:3000).
 * - Adds a custom middleware that sets the `X-Global: enabled` response header.
 */
export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Replace the default `cors` middleware with one that also accepts the
  // http://localhost:5000 origin.
  middlewareConfig.set(
    'cors',
    cors({
      origin: [...config.allowedCORSOrigins, 'http://localhost:5000'],
    })
  );

  // Custom middleware that sets a response header on every request.
  middlewareConfig.set('x-global-header', (_req, res, next) => {
    res.setHeader('X-Global', 'enabled');
    next();
  });

  return middlewareConfig;
};
