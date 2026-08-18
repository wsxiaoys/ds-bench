import { app, page, route, api, job } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { ingestSample, enqueueRollup, getDashboard } from "./src/apis" with { type: "ref" };
import { rollupMetrics } from "./src/jobs" with { type: "ref" };

export default app({
  name: "waspmetrics",
  wasp: { version: "^0.25.0" },
  title: "waspmetrics",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  spec: [
    route("RootRoute", "/", page(MainPage)),
    api("POST", "/api/samples", ingestSample, { entities: ["Sample"], auth: false }),
    api("POST", "/api/rollup", enqueueRollup, { auth: false }),
    api("GET", "/api/dashboard", getDashboard, { entities: ["RollupResult"], auth: false }),
    job(rollupMetrics, {
      executor: "PgBoss",
      entities: ["Sample", "RollupResult"],
      schedule: {
        cron: "23 3 * * *",
        args: { reason: "cron" }
      }
    })
  ],
});
