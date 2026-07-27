import { getMetricsState } from "./metricsDOClient";
import { MetricsDashboard } from "./MetricsDashboard";

export async function MetricsPage() {
  const initialState = await getMetricsState();

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1.5rem" }}>
      <MetricsDashboard initialState={initialState} />
    </div>
  );
}
