import { useEffect, useState } from "react";
import { api } from "wasp/client/api";
import "./Main.css";

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
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get("api/dashboard").json<MetricData[]>();
      setData(response);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "-";
    return String(val);
  };

  const registeredMetrics = ["error_rate", "latency_ms", "queue_depth"];

  const getMetricData = (metricName: string): MetricData => {
    const found = data.find((d) => d.metric === metricName);
    if (found) return found;
    return {
      metric: metricName,
      count: 0,
      p95: null,
      avg: null,
      delta: null,
      updatedAt: null,
    };
  };

  return (
    <main className="container">
      <h1 className="title">Waspleau Metrics Dashboard</h1>

      {loading && <p className="loading">Loading...</p>}
      {error && <p className="error">{error}</p>}

      <div className="metrics-grid">
        {registeredMetrics.map((metricName) => {
          const metricData = getMetricData(metricName);
          return (
            <div
              key={metricName}
              className="metric-card"
              data-metric={metricName}
            >
              <h2 className="metric-title">{metricName}</h2>
              <div className="metric-fields">
                <div className="metric-field">
                  <span className="field-label">Count:</span>
                  <span data-field="count" className="field-value">
                    {formatValue(metricData.count)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">P95:</span>
                  <span data-field="p95" className="field-value">
                    {formatValue(metricData.p95)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Average:</span>
                  <span data-field="avg" className="field-value">
                    {formatValue(metricData.avg)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Delta:</span>
                  <span data-field="delta" className="field-value">
                    {formatValue(metricData.delta)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Updated At:</span>
                  <span data-field="updatedAt" className="field-value">
                    {formatValue(metricData.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="buttons">
        <button className="button button-filled" onClick={fetchDashboard}>
          Refresh
        </button>
      </div>
    </main>
  );
}
