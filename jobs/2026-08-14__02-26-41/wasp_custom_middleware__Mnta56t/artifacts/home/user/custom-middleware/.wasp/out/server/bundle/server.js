import http from 'http';
import express from 'express';
import * as z from 'zod';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import helmet from 'helmet';

const colors = {
  red: "\x1B[31m",
  yellow: "\x1B[33m"
};
const resetColor = "\x1B[0m";
function getColorizedConsoleFormatString(colorKey) {
  const color = colors[colorKey];
  return `${color}%s${resetColor}`;
}

const redColorFormatString = getColorizedConsoleFormatString("red");
function ensureEnvSchema(data, schema) {
  const result = getValidatedEnvOrError(data, schema);
  if (result.success) {
    return result.data;
  } else {
    console.error(`${redColorFormatString}${formatZodEnvErrors(result.error.issues)}`);
    throw new Error("Error parsing environment variables");
  }
}
function getValidatedEnvOrError(env, schema) {
  return schema.safeParse(env);
}
function formatZodEnvErrors(issues) {
  const errorOutput = ["", "\u2550\u2550 Env vars validation failed \u2550\u2550", ""];
  for (const error of issues) {
    errorOutput.push(` - ${error.message}`);
  }
  errorOutput.push("");
  errorOutput.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return errorOutput.join("\n");
}

const userServerEnvSchema = z.object({});
const waspServerCommonSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string({
    required_error: "DATABASE_URL is required"
  }),
  PG_BOSS_NEW_OPTIONS: z.string().optional(),
  SKIP_EMAIL_VERIFICATION_IN_DEV: z.enum(["true", "false"], {
    message: 'SKIP_EMAIL_VERIFICATION_IN_DEV must be either "true" or "false"'
  }).transform((value) => value === "true").default("false")
});
const serverUrlSchema = z.string({
  required_error: "WASP_SERVER_URL is required"
}).url({
  message: "WASP_SERVER_URL must be a valid URL"
});
const clientUrlSchema = z.string({
  required_error: "WASP_WEB_CLIENT_URL is required"
}).url({
  message: "WASP_WEB_CLIENT_URL must be a valid URL"
});
const serverDevSchema = z.object({
  NODE_ENV: z.literal("development"),
  "WASP_SERVER_URL": serverUrlSchema.default("http://localhost:3001"),
  "WASP_WEB_CLIENT_URL": clientUrlSchema.default("http://localhost:3000/")
});
const serverProdSchema = z.object({
  NODE_ENV: z.literal("production"),
  "WASP_SERVER_URL": serverUrlSchema,
  "WASP_WEB_CLIENT_URL": clientUrlSchema
});
const serverCommonSchema = userServerEnvSchema.merge(waspServerCommonSchema);
const serverEnvSchema = z.discriminatedUnion("NODE_ENV", [
  serverDevSchema.merge(serverCommonSchema),
  serverProdSchema.merge(serverCommonSchema)
]);
const defaultNodeEnvValue = serverDevSchema.shape.NODE_ENV.value;
const { NODE_ENV: inputNodeEnvValue, ...restEnv } = process.env;
const env = ensureEnvSchema({
  NODE_ENV: inputNodeEnvValue ?? defaultNodeEnvValue,
  ...restEnv
}, serverEnvSchema);

function stripTrailingSlash(url) {
  return url?.replace(/\/$/, "");
}
function getOrigin(url) {
  return new URL(url).origin;
}

const frontendUrl = stripTrailingSlash(env["WASP_WEB_CLIENT_URL"]);
stripTrailingSlash(env["WASP_SERVER_URL"]);
const allowedCORSOriginsPerEnv = {
  development: [/.*/],
  production: [getOrigin(frontendUrl)]
};
const allowedCORSOrigins = allowedCORSOriginsPerEnv[env.NODE_ENV];
const config = {
  frontendUrl,
  allowedCORSOrigins,
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  port: env.PORT,
  databaseUrl: env.DATABASE_URL
};

class HttpError extends Error {
  statusCode;
  data;
  constructor(statusCode, message, data, options) {
    super(message, options);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
    this.name = this.constructor.name;
    if (!(Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600)) {
      throw new Error("statusCode has to be integer in range [400, 600).");
    }
    this.statusCode = statusCode;
    if (data) {
      this.data = data;
    }
  }
}

const router$2 = express.Router();

const serverMiddlewareFn = (middlewareConfig) => {
  middlewareConfig.set("cors", cors({ origin: [...config.allowedCORSOrigins, "http://localhost:5000"] }));
  middlewareConfig.set("x-global", (req, res, next) => {
    res.set("X-Global", "enabled");
    next();
  });
  return middlewareConfig;
};
const apiNamespaceMiddlewareFn = (middlewareConfig) => {
  middlewareConfig.delete("express.json");
  middlewareConfig.delete("express.urlencoded");
  middlewareConfig.set("x-api-namespace", (req, res, next) => {
    res.set("X-Api-Namespace", "v1");
    next();
  });
  return middlewareConfig;
};
const echoMiddlewareFn = (middlewareConfig) => {
  middlewareConfig.set("express.json", express.raw({ type: "*/*" }));
  middlewareConfig.set("x-echo", (req, res, next) => {
    res.set("X-Echo", "raw");
    next();
  });
  return middlewareConfig;
};

const defaultGlobalMiddlewareConfig = /* @__PURE__ */ new Map([
  ["helmet", helmet()],
  ["cors", cors({ origin: config.allowedCORSOrigins })],
  ["logger", logger("dev")],
  ["express.json", express.json()],
  ["express.urlencoded", express.urlencoded()],
  ["cookieParser", cookieParser()]
]);
const globalMiddlewareConfig = serverMiddlewareFn(defaultGlobalMiddlewareConfig);
function globalMiddlewareConfigForExpress(middlewareConfigFn) {
  if (!middlewareConfigFn) {
    return Array.from(globalMiddlewareConfig.values());
  }
  const globalMiddlewareConfigClone = new Map(globalMiddlewareConfig);
  const modifiedMiddlewareConfig = middlewareConfigFn(globalMiddlewareConfigClone);
  return Array.from(modifiedMiddlewareConfig.values());
}

const defineHandler = (middleware) => middleware;

const status = (req, res, context) => {
  res.json({ status: "ok" });
};
const echo = (req, res, context) => {
  console.log("echo req.body:", req.body, "type:", typeof req.body, "isBuffer:", Buffer.isBuffer(req.body));
  let bytes = 0;
  if (Buffer.isBuffer(req.body)) {
    bytes = req.body.length;
  } else if (typeof req.body === "string") {
    bytes = Buffer.byteLength(req.body);
  }
  res.json({ bytes });
};

const idFn = (x) => x;
const _waspstatusmiddlewareConfigFn = idFn;
const router$1 = express.Router();
router$1.use("/api", globalMiddlewareConfigForExpress(apiNamespaceMiddlewareFn));
const statusMiddleware = globalMiddlewareConfigForExpress(_waspstatusmiddlewareConfigFn);
router$1.get(
  "/api/status",
  statusMiddleware,
  defineHandler(
    (req, res) => {
      return status(req, res);
    }
  )
);
const echoMiddleware = globalMiddlewareConfigForExpress(echoMiddlewareFn);
router$1.post(
  "/api/echo",
  echoMiddleware,
  defineHandler(
    (req, res) => {
      return echo(req, res);
    }
  )
);

const makeWrongPortPage = ({
  appName,
  frontendUrl
}) => (
  /* HTML */
  `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${appName} API Server</title>

      <style>
        :root {
          --page-background: #f0f0f0;
          --wrapper-background: white;
          --wasp-yellow: #f5cc05;
          --main-link-color: #1a73e8;
        }

        .wrapper {
          font-family: system-ui, sans-serif;
          width: 90%;
          max-width: 600px;
          margin: 2em auto;
        }

        h1,
        h2 {
          margin: 0;
        }

        .main-link {
          text-align: center;
          font-size: 1.5em;
          font-weight: bold;
          font-family: ui-monospace, monospace;
        }

        .icon {
          width: 1em;
          height: 1em;
        }

        .wasp-title {
          margin: 0.5em 0;
          display: flex;
          align-items: center;
          gap: 0.2em;
        }

        body {
          background-color: var(--page-background);
        }

        main {
          background-color: var(--wrapper-background);
          padding: 1.5em;
          border-radius: 10px;
        }

        a,
        a:visited {
          color: var(--main-link-color);
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <header>
          <h2 class="wasp-title">
            <svg viewBox="0 0 161 161" class="icon" alt="Wasp Logo">
              <circle cx="80.5" cy="80.5" r="79" fill="var(--wasp-yellow)" />
              <path
                d="M88.67 114.33h2.91q6 0 7.87-1.89c1.22-1.25 1.83-3.9 1.83-7.93V93.89c0-4.46.65-7.7 1.93-9.73s3.51-3.43 6.67-4.2q-4.69-1.08-6.65-4.12c-1.3-2-2-5.28-2-9.77V55.44q0-6-1.83-7.93t-7.87-1.88h-2.86V39.5h2.65q10.65 0 14.24 3.15t3.59 12.62v10.29c0 4.28.77 7.24 2.29 8.87s4.3 2.44 8.32 2.44h2.74V83h-2.74q-6 0-8.32 2.49c-1.52 1.65-2.29 4.64-2.29 9v10.25q0 9.47-3.59 12.64t-14.24 3.12h-2.65Z"
              />
              <path d="M38.5 85.15h37.33v7.58H38.5Zm0-17.88h37.33v7.49H38.5Z" />
            </svg>
            Wasp
          </h2>
        </header>

        <main>
          <h1>${appName} API Server</h1>
          <p>
            The server is up and running. This is the backend part of your Wasp
            application.
          </p>
          <p>
            If you want to visit your frontend application, go to this URL in
            your browser:
          </p>
          <a href="${frontendUrl}" class="main-link">
            <p>${frontendUrl}</p>
          </a>
          <p>
            <small>
              This message is shown because you are running the server in
              development mode. In production, this route would not show
              anything.
            </small>
          </p>
        </main>
      </div>
    </body>
  </html>
`
);

const router = express.Router();
const middleware = globalMiddlewareConfigForExpress();
router.get(
  "/",
  middleware,
  function(_req, res) {
    const data = {
      appName: "customMiddleware",
      frontendUrl: config.frontendUrl
    };
    const wrongPortPage = makeWrongPortPage(data);
    res.status(200).type("html").send(wrongPortPage);
  }
);
router.use("/operations", middleware, router$2);
router.use(router$1);

const app = express();
app.use("/", router);
app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, data: err.data });
  }
  return next(err);
});

const startServer = async () => {
  const port = normalizePort(config.port);
  app.set("port", port);
  const server = http.createServer(app);
  server.listen(port);
  server.on("error", (error) => {
    if (error.syscall !== "listen") throw error;
    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
      default:
        throw error;
    }
  });
  server.on("listening", () => {
    const addr = server.address();
    const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    console.log("Server listening on " + bind);
  });
};
startServer().catch((e) => console.error(e));
function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}
//# sourceMappingURL=server.js.map
