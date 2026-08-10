import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsPage } from "@/app/metrics/metrics-page";
import { MetricsDurableObject } from "@/app/metrics/metrics-do";

export type AppContext = {};

export { MetricsDurableObject };

function getMetricsStub() {
  const id = env.METRICS.idFromName("shared");
  return env.METRICS.get(id);
}

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", Home),

    // Metrics dashboard page
    route("/metrics", () => <MetricsPage />),

    // Metrics API endpoints (proxied to the Durable Object)
    route("/metrics/ws", ({ request }) => {
      const stub = getMetricsStub();
      return stub.fetch(
        new Request(new URL("/ws", request.url), request)
      );
    }),
    route("/metrics/start", {
      post: async () => {
        const stub = getMetricsStub();
        return stub.fetch("https://do/start");
      },
    }),
    route("/metrics/stop", {
      post: async () => {
        const stub = getMetricsStub();
        return stub.fetch("https://do/stop");
      },
    }),
    route("/metrics/set-threshold", {
      post: async ({ request }) => {
        const stub = getMetricsStub();
        return stub.fetch("https://do/set-threshold", {
          method: "POST",
          body: JSON.stringify(await request.json()),
        });
      },
    }),
    route("/metrics/state", {
      get: async () => {
        const stub = getMetricsStub();
        return stub.fetch("https://do/state");
      },
    }),
  ]),
]);
