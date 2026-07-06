import { registerGateways, run } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { gateway as api_gatewayImpl } from "../../../../../src/gateway";

const gateways = [
    api_gatewayImpl,
];

registerGateways(gateways);

await run(import.meta.url);
