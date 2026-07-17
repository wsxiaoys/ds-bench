import cors from 'cors';
import { config } from 'wasp/server';
/**
 * Global server middleware configuration.
 *
 * This function customizes the default Express middleware stack that Wasp
 * installs on every operation and API route.
 */
export const serverMiddlewareFn = (middlewareConfig) => {
    // Extend the allowed CORS origins so requests from the local origin
    // http://localhost:5000 are accepted, while keeping the existing/default
    // allowed origins (including the local client at http://localhost:3000).
    middlewareConfig.set('cors', cors({ origin: [...config.allowedCORSOrigins, 'http://localhost:5000'] }));
    // Add a custom middleware entry that sets the X-Global: enabled response
    // header on every response.
    middlewareConfig.set('globalHeader', (_req, res, next) => {
        res.setHeader('X-Global', 'enabled');
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=serverSetup.js.map