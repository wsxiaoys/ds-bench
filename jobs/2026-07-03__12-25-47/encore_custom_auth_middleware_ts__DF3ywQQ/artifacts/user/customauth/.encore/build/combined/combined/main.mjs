// This file was bundled by Encore v1.57.9
//
// https://encore.dev

// encore.gen/internal/entrypoints/combined/main.ts
import { registerGateways, registerHandlers, run } from "encore.dev/internal/codegen/appinit";

// src/gateway.ts
import { Gateway } from "encore.dev/api";

// src/auth.ts
import { authHandler } from "encore.dev/auth";
import { APIError } from "encore.dev/api";
var myAuth = authHandler(
  async (params) => {
    const authHeader = params.authorization;
    if (!authHeader) {
      throw APIError.unauthenticated("missing authorization header");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === "") {
      throw APIError.unauthenticated("missing bearer token");
    }
    if (token !== "secret-token") {
      throw APIError.unauthenticated("invalid token");
    }
    return {
      userID: "user-123"
    };
  }
);

// src/gateway.ts
var gateway = new Gateway({ authHandler: myAuth });

// src/dashboard.ts
import { api } from "encore.dev/api";

// encore.gen/internal/auth/auth.ts
import { getAuthData as _getAuthData } from "encore.dev/internal/codegen/auth";
function getAuthData() {
  return _getAuthData();
}

// src/dashboard.ts
var getDashboard = api(
  { auth: true, method: "GET", path: "/dashboard", expose: true },
  async () => {
    const auth = getAuthData();
    return {
      message: `Welcome to the dashboard, ${auth.userID}!`
    };
  }
);

// encore.gen/internal/entrypoints/combined/main.ts
var gateways = [
  gateway
];
var handlers = [
  {
    apiRoute: {
      service: "src",
      name: "getDashboard",
      handler: getDashboard,
      raw: false,
      streamingRequest: false,
      streamingResponse: false
    },
    endpointOptions: { "expose": true, "auth": true, "isRaw": false, "isStream": false, "tags": [] },
    middlewares: []
  }
];
registerGateways(gateways);
registerHandlers(handlers);
await run(import.meta.url);
//# sourceMappingURL=main.mjs.map
