import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { createRecord as cleanup_createRecordImpl0 } from "../../../../cleanup/cleanup";
import { cleanup as cleanup_cleanupImpl1 } from "../../../../cleanup/cleanup";


const gateways: any[] = [
];

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "cleanup",
            name:              "createRecord",
            handler:           cleanup_createRecordImpl0,
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
            handler:           cleanup_cleanupImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
];

registerGateways(gateways);
registerHandlers(handlers);

await run(import.meta.url);
