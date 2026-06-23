import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { dashboard as dashboardImpl0 } from "../../../../../encore.service";
import * as customauth_service from "../../../../../encore.service";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "customauth",
            name:              "dashboard",
            handler:           dashboardImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: customauth_service.default.cfg.middlewares || [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
