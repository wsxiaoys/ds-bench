import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { gateway as api_gatewayGW } from "../../../../src/gateway";
import { getDashboard as src_getDashboardImpl0 } from "../../../../src/dashboard";


const gateways: any[] = [
    api_gatewayGW,
];

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "src",
            name:              "getDashboard",
            handler:           src_getDashboardImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: [],
    },
];

registerGateways(gateways);
registerHandlers(handlers);

await run(import.meta.url);
