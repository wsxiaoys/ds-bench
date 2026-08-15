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
  const [data, setData] = useState<MetricData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    try {
      const res = await api.get("dashboard").json<MetricData[]>();
      setData(res);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return "-";
    return String(val);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Waspleau Metrics Rollup Pipeline</h1>
        <button onClick={fetchData} className="refresh-button">Refresh</button>
      </header>

      {loading && !data && <div className="loading">Loading dashboard data...</div>}
      {error && <div className="error">{error}</div>}

      {data && (
        <div className="metrics-grid">
          {data.map((item) => (
            <div key={item.metric} className="metric-card" data-metric={item.metric}>
              <h2 className="metric-title">{item.metric.replace("_", " ")}</h2>
              <div className="metric-fields">
                <div className="metric-field">
                  <span className="field-label">Count</span>
                  <span className="field-value" data-field="count">
                    {renderValue(item.count)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">P95</span>
                  <span className="field-value" data-field="p95">
                    {renderValue(item.p95)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Average</span>
                  <span className="field-value" data-field="avg">
                    {renderValue(item.avg)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Delta</span>
                  <span className="field-value" data-field="delta">
                    {renderValue(item.delta)}
                  </span>
                </div>
                <div className="metric-field">
                  <span className="field-label">Updated At</span>
                  <span className="field-value" data-field="updatedAt">
                    {renderValue(item.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
