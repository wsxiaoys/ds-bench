import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsDashboard } from "@/app/pages/metrics";

export { MetricsServer } from "./metrics-server";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  route("/api/metrics/*", async ({ request }) => {
    const envAny = env as any;
    const id = envAny.METRICS_SERVER.idFromName("global");
    const stub = envAny.METRICS_SERVER.get(id);
    return stub.fetch(request);
  }),
  render(Document, [
    route("/", Home),
    route("/metrics", MetricsDashboard),
  ]),
]);
