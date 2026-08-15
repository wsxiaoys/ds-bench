import { api, app, job, page, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { ingestSample, enqueueRollup, getDashboard } from "./src/apis" with { type: "ref" };
import { rollupMetrics } from "./src/workers/rollup" with { type: "ref" };

export default app({
  name: "waspmetrics",
  wasp: { version: "^0.25.0" },
  title: "waspmetrics",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  spec: [
    route("RootRoute", "/", page(MainPage)),
    api("POST", "/api/samples", ingestSample, { entities: ["Sample"] }),
    api("POST", "/api/rollup", enqueueRollup, { entities: [] }),
    api("GET", "/api/dashboard", getDashboard, { entities: ["MetricRollup"] }),
    job(rollupMetrics, {
      executor: "PgBoss",
      entities: ["Sample", "MetricRollup"],
      schedule: {
        cron: "23 3 * * *",
        args: { reason: "cron" }
      }
    }),
  ],
});
