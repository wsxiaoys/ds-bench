import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { createRecord as createRecordImpl0 } from "../../../../../cleanup/cleanup";
import { cleanup as cleanupImpl1 } from "../../../../../cleanup/cleanup";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "cleanup",
            name:              "createRecord",
            handler:           createRecordImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
    {
        apiRoute: {
            service:           "cleanup",
            name:              "cleanup",
            handler:           cleanupImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
