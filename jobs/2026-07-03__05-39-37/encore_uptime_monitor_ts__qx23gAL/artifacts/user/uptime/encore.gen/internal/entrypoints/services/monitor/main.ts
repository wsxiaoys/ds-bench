import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { addSite as addSiteImpl0 } from "../../../../../monitor/monitor";
import { listSites as listSitesImpl1 } from "../../../../../monitor/monitor";
import { checkAll as checkAllImpl2 } from "../../../../../monitor/monitor";
import "../../../../../monitor/monitor";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "monitor",
            name:              "addSite",
            handler:           addSiteImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
    {
        apiRoute: {
            service:           "monitor",
            name:              "listSites",
            handler:           listSitesImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
    {
        apiRoute: {
            service:           "monitor",
            name:              "checkAll",
            handler:           checkAllImpl2,
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
