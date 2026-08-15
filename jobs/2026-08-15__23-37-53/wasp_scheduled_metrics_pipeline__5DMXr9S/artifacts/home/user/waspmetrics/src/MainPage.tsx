import React, { useEffect, useState } from "react";
import { api } from "wasp/client/api";

interface MetricData {
  metric: string;
  count: number;
  p95: number | null;
  avg: number | null;
  delta: number | null;
  updatedAt: string | null;
}

export function MainPage() {
  const [data, setData] = useState<MetricData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.get("api/dashboard").json<MetricData[]>();
        setData(result);
      } catch (err: any) {
        console.error("Error fetching dashboard:", err);
        setError(err.message || "Failed to fetch dashboard data");
      }
    }
    fetchData();
    // Periodically refresh the dashboard
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Helper to format values: use '-' if null, otherwise convert to string
  const formatVal = (val: any) => {
    if (val === null || val === undefined) {
      return "-";
    }
    return String(val);
  };

  const registeredMetrics = ["error_rate", "latency_ms", "queue_depth"];

  // Ensure we render all three registered metrics, even if data hasn't loaded yet
  const metricsToRender = registeredMetrics.map(metricName => {
    const found = data.find(d => d.metric === metricName);
    return found || {
      metric: metricName,
      count: 0,
      p95: null,
      avg: null,
      delta: null,
      updatedAt: null,
    };
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Operations Dashboard</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {metricsToRender.map((m) => (
          <div key={m.metric} data-metric={m.metric} style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "8px" }}>
            <h3>{m.metric}</h3>
            <p>Count: <span data-field="count">{formatVal(m.count)}</span></p>
            <p>P95: <span data-field="p95">{formatVal(m.p95)}</span></p>
            <p>Avg: <span data-field="avg">{formatVal(m.avg)}</span></p>
            <p>Delta: <span data-field="delta">{formatVal(m.delta)}</span></p>
            <p>Updated At: <span data-field="updatedAt">{formatVal(m.updatedAt)}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}
