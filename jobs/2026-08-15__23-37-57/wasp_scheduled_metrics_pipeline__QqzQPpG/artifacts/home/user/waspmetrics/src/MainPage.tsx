import { useEffect, useState } from "react";
import { config } from "wasp/client";
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
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggerMsg, setTriggeringMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/dashboard`);
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to fetch dashboard data");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // 5 seconds refresh
    return () => clearInterval(interval);
  }, []);

  const handleTriggerRollup = async () => {
    setTriggering(true);
    setTriggeringMsg(null);
    try {
      const response = await fetch(`${config.apiUrl}/api/rollup`, {
        method: "POST"
      });
      if (response.ok) {
        const res = await response.json();
        setTriggeringMsg(`Rollup enqueued successfully. Job ID: ${res.jobId}`);
        // Refresh data in a bit
        setTimeout(fetchData, 1000);
      } else {
        throw new Error("Failed to enqueue rollup");
      }
    } catch (err: any) {
      setTriggeringMsg(`Error: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) {
      return "-";
    }
    return String(val);
  };

  const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];

  return (
    <main className="container">
      <h1 className="title">Waspleau-style Metrics Dashboard</h1>
      
      {error && <div className="error">Error: {error}</div>}

      <div style={{ marginBottom: "20px" }}>
        <button 
          onClick={handleTriggerRollup} 
          disabled={triggering}
          className="button button-filled"
        >
          {triggering ? "Queueing Rollup..." : "Trigger Rollup Now"}
        </button>
        {triggerMsg && <div style={{ marginTop: "10px", fontSize: "14px" }}>{triggerMsg}</div>}
      </div>

      <div className="metrics-grid">
        {registeredMetrics.map((metricName) => {
          const metricItem = data?.find((d) => d.metric === metricName) || {
            metric: metricName,
            count: 0,
            p95: null,
            avg: null,
            delta: null,
            updatedAt: null,
          };

          return (
            <div key={metricName} className="metric-card" data-metric={metricName}>
              <h3>{metricName}</h3>
              <div className="field-group">
                <div className="field-row">
                  <span className="field-label">Count:</span>
                  <span data-field="count">{formatValue(metricItem.count)}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">P95:</span>
                  <span data-field="p95">{formatValue(metricItem.p95)}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">Avg:</span>
                  <span data-field="avg">{formatValue(metricItem.avg)}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">Delta:</span>
                  <span data-field="delta">{formatValue(metricItem.delta)}</span>
                </div>
                <div className="field-row">
                  <span className="field-label">Updated At:</span>
                  <span data-field="updatedAt">{formatValue(metricItem.updatedAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
