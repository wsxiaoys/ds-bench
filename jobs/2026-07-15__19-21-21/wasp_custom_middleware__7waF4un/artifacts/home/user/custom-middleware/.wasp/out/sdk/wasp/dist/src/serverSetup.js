import cors from "cors";
import { config } from "wasp/server";
// Global server middleware.
// - Extends the CORS allowed origins with http://localhost:5000 while keeping
//   the default allowed origins (e.g. the client at http://localhost:3000) intact.
// - Adds a custom middleware that sets the `X-Global` response header on every
//   response served by the Express server.
export const serverMiddlewareFn = (middlewareConfig) => {
    middlewareConfig.set("cors", cors({
        origin: [...config.allowedCORSOrigins, "http://localhost:5000"],
    }));
    middlewareConfig.set("global.custom", (_req, res, next) => {
        res.set("X-Global", "enabled");
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=serverSetup.js.map