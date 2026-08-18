import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsPage } from "@/app/pages/metrics";

export { MetricsDO } from "./app/MetricsDO";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", Home),
    route("/metrics", MetricsPage),
    route("/metrics/:action", async ({ params, request }) => {
      const { action } = params;
      const id = env.METRICS_DO.idFromName("global");
      const obj = env.METRICS_DO.get(id);

      const url = new URL(request.url);
      const doUrl = new URL(`/${action}`, "http://metrics-do");
      doUrl.search = url.search;

      const doRequest = new Request(doUrl.toString(), request);
      return obj.fetch(doRequest);
    }),
  ]),
]);
