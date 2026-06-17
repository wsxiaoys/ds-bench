import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";


export async function createRecord(params, opts) {
    const handler = (await import("../../../../cleanup/cleanup")).createRecord;
    registerTestHandler({
        apiRoute: { service: "cleanup", name: "createRecord", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("cleanup", "createRecord", params, opts);
}

export async function cleanup(params, opts) {
    const handler = (await import("../../../../cleanup/cleanup")).cleanup;
    registerTestHandler({
        apiRoute: { service: "cleanup", name: "cleanup", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("cleanup", "cleanup", params, opts);
}

