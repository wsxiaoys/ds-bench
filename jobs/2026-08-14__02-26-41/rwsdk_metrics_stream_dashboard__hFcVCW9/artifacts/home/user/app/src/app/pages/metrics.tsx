import { env } from "cloudflare:workers";
import { MetricsClient } from "./MetricsClient";

export async function MetricsPage() {
  const id = env.METRICS_DO.idFromName("global");
  const obj = env.METRICS_DO.get(id);
  const res = await obj.fetch(new Request("http://metrics-do/state"));
  const initialState = (await res.json()) as any;

  return <MetricsClient initialState={initialState} />;
}
