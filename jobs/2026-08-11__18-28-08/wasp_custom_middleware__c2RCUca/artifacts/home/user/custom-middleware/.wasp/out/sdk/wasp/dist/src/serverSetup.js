import cors from "cors";
import { config } from "wasp/server";
export const serverMiddlewareFn = (middlewareConfig) => {
    // Extends the allowed CORS origins so requests from the local origin http://localhost:5000 are accepted,
    // while keeping the existing/default allowed origins (including the local client at http://localhost:3000) working.
    const allowedOrigins = Array.isArray(config.allowedCORSOrigins)
        ? [...config.allowedCORSOrigins, "http://localhost:5000"]
        : [config.allowedCORSOrigins, "http://localhost:5000"].filter(Boolean);
    middlewareConfig.set("cors", cors({ origin: allowedOrigins }));
    // Adds a custom middleware entry that sets the response header X-Global: enabled on responses.
    middlewareConfig.set("globalHeader", (req, res, next) => {
        res.setHeader("X-Global", "enabled");
        next();
    });
    return middlewareConfig;
};
//# sourceMappingURL=serverSetup.js.map