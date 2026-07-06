import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";


export async function addSite(params, opts) {
    const handler = (await import("../../../../monitor/monitor")).addSite;
    registerTestHandler({
        apiRoute: { service: "monitor", name: "addSite", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("monitor", "addSite", params, opts);
}

export async function listSites(params, opts) {
    const handler = (await import("../../../../monitor/monitor")).listSites;
    registerTestHandler({
        apiRoute: { service: "monitor", name: "listSites", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("monitor", "listSites", params, opts);
}

export async function checkAll(params, opts) {
    const handler = (await import("../../../../monitor/monitor")).checkAll;
    registerTestHandler({
        apiRoute: { service: "monitor", name: "checkAll", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("monitor", "checkAll", params, opts);
}

