import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsPage } from "@/app/pages/metrics/MetricsPage";
import { forwardToMetricsDO } from "@/app/pages/metrics/metricsDOClient";

export type AppContext = {};

// Durable Object classes must be exported from the worker's main entry so
// that the Workers runtime can find them via wrangler.jsonc's
// `durable_objects` binding / `migrations` config.
export { MetricsDO } from "@/durableObjects/metricsDO";

export default defineApp([
  setCommonHeaders(),

  // JSON API used by the metrics dashboard client to drive the shared,
  // server-side producer that lives in the MetricsDO Durable Object.
  route("/metrics/api/state", async () => {
    return forwardToMetricsDO("/state", { method: "GET" });
  }),
  route("/metrics/api/start", async () => {
    return forwardToMetricsDO("/start", { method: "POST" });
  }),
  route("/metrics/api/stop", async () => {
    return forwardToMetricsDO("/stop", { method: "POST" });
  }),
  route("/metrics/api/threshold", async ({ request }) => {
    const body = await request.text();
    return forwardToMetricsDO("/threshold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  }),

  render(Document, [route("/", Home), route("/metrics", MetricsPage)]),
]);
