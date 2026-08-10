import { env } from "cloudflare:workers";

import type { MetricsState } from "@/durableObjects/metricsDO";

const DO_INSTANCE_NAME = "global";

function getStub() {
  const id = env.METRICS_DO.idFromName(DO_INSTANCE_NAME);
  return env.METRICS_DO.get(id);
}

export async function getMetricsState(): Promise<MetricsState> {
  const stub = getStub();
  const res = await stub.fetch("http://do/state");
  return res.json();
}

export async function forwardToMetricsDO(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const stub = getStub();
  return stub.fetch(`http://do${path}`, init);
}
