import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";

import * as customauth_service from "../../../../encore.service";

export async function dashboard(params, opts) {
    const handler = (await import("../../../../encore.service")).dashboard;
    registerTestHandler({
        apiRoute: { service: "customauth", name: "dashboard", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: customauth_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("customauth", "dashboard", params, opts);
}

