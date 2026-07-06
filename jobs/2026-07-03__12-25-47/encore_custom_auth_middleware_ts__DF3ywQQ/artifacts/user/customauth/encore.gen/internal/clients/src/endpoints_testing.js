import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";


export async function getDashboard(params, opts) {
    const handler = (await import("../../../../src/dashboard")).getDashboard;
    registerTestHandler({
        apiRoute: { service: "src", name: "getDashboard", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("src", "getDashboard", params, opts);
}

