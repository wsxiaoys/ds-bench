import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { dashboard as customauth_dashboardImpl0 } from "../../../../encore.service";
import * as customauth_service from "../../../../encore.service";


const gateways: any[] = [
];

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "customauth",
            name:              "dashboard",
            handler:           customauth_dashboardImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: customauth_service.default.cfg.middlewares || [],
    },
];

registerGateways(gateways);
registerHandlers(handlers);

await run(import.meta.url);
