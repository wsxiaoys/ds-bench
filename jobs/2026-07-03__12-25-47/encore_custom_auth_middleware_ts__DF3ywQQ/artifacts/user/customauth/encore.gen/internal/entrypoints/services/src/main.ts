import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { getDashboard as getDashboardImpl0 } from "../../../../../src/dashboard";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "src",
            name:              "getDashboard",
            handler:           getDashboardImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
