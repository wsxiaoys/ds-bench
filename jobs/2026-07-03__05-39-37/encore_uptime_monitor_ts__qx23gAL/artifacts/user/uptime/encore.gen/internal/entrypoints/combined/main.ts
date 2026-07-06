import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { addSite as monitor_addSiteImpl0 } from "../../../../monitor/monitor";
import { listSites as monitor_listSitesImpl1 } from "../../../../monitor/monitor";
import { checkAll as monitor_checkAllImpl2 } from "../../../../monitor/monitor";
import "../../../../monitor/monitor";


const gateways: any[] = [
];

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "monitor",
            name:              "addSite",
            handler:           monitor_addSiteImpl0,
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
            handler:           monitor_listSitesImpl1,
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
            handler:           monitor_checkAllImpl2,
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
