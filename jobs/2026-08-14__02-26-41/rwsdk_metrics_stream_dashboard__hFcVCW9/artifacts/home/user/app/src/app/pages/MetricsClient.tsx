"use client";

import { useEffect, useState } from "react";

interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

interface State {
  running: boolean;
  seq: number;
  min: number | null;
  max: number | null;
  alertCount: number;
  threshold: number | null;
  history: Tick[];
}

interface Props {
  initialState: State;
}

export function MetricsClient({ initialState }: Props) {
  const [state, setState] = useState<State>(initialState);
  const [inputValue, setInputValue] = useState(
    initialState.threshold !== null ? String(initialState.threshold) : ""
  );

  useEffect(() => {
    const eventSource = new EventSource("/metrics/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state") {
          setState(data.state);
          if (data.state.threshold !== null) {
            setInputValue(String(data.state.threshold));
          } else {
            setInputValue("");
          }
        } else if (data.type === "tick") {
          setState((prev) => {
            const exists = prev.history.some((t) => t.seq === data.tick.seq);
            const newHistory = exists
              ? prev.history
              : [data.tick, ...prev.history].slice(0, 100);

            return {
              ...prev,
              ...data.state,
              history: newHistory,
            };
          });
        }
      } catch (e) {
        console.error("Error parsing stream message", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStart = async () => {
    await fetch("/metrics/start", { method: "POST" });
  };

  const handleStop = async () => {
    await fetch("/metrics/stop", { method: "POST" });
  };

  const handleApplyThreshold = async () => {
    const val = inputValue === "" ? null : Number(inputValue);
    await fetch("/metrics/threshold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: val }),
    });
  };

  const latestTick = state.history[0];
  const latestValue = latestTick ? latestTick.value : null;
  const isOverThreshold =
    latestValue !== null &&
    state.threshold !== null &&
    latestValue > state.threshold;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Live Metrics Dashboard</h1>
        <div style={styles.statusBadge(state.running)}>
          {state.running ? "● Live Streaming" : "○ Stopped"}
        </div>
      </header>

      <section style={styles.controlsSection}>
        <div style={styles.controlGroup}>
          <button
            data-testid="start-stream"
            onClick={handleStart}
            style={styles.button(true, state.running)}
            disabled={state.running}
          >
            Start Stream
          </button>
          <button
            data-testid="stop-stream"
            onClick={handleStop}
            style={styles.button(false, !state.running)}
            disabled={!state.running}
          >
            Stop Stream
          </button>
        </div>

        <div style={styles.controlGroup}>
          <span style={styles.label}>Alert Threshold:</span>
          <input
            type="number"
            data-testid="threshold-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={styles.input}
            placeholder="No threshold"
          />
          <button
            data-testid="apply-threshold"
            onClick={handleApplyThreshold}
            style={styles.applyButton}
          >
            Apply
          </button>
        </div>
      </section>

      <div style={styles.grid}>
        <div style={styles.card(isOverThreshold)}>
          <h2 style={styles.cardTitle}>Current Value</h2>
          <div
            data-testid="current-value"
            {...(isOverThreshold ? { "data-over": "true" } : {})}
            style={styles.currentValueText(isOverThreshold)}
          >
            {latestValue !== null ? latestValue : "-"}
          </div>
          {state.threshold !== null && (
            <div style={styles.thresholdIndicator}>
              Threshold: {state.threshold}
            </div>
          )}
        </div>

        <div style={styles.card()}>
          <h2 style={styles.cardTitle}>Tick Count</h2>
          <div data-testid="tick-count" style={styles.metricValue}>
            {state.seq}
          </div>
        </div>

        <div style={styles.card()}>
          <h2 style={styles.cardTitle}>Min Value</h2>
          <div data-testid="min-value" style={styles.metricValue}>
            {state.min !== null ? state.min : "-"}
          </div>
        </div>

        <div style={styles.card()}>
          <h2 style={styles.cardTitle}>Max Value</h2>
          <div data-testid="max-value" style={styles.metricValue}>
            {state.max !== null ? state.max : "-"}
          </div>
        </div>

        <div style={styles.card(state.alertCount > 0, true)}>
          <h2 style={styles.cardTitle}>Alert Count</h2>
          <div data-testid="alert-count" style={styles.metricValue}>
            {state.alertCount}
          </div>
        </div>
      </div>

      <section style={styles.historySection}>
        <h2 style={styles.historyTitle}>Tick History</h2>
        <div data-testid="history" style={styles.historyContainer}>
          {state.history.length === 0 ? (
            <div style={styles.emptyHistory}>No ticks emitted yet.</div>
          ) : (
            state.history.map((tick) => (
              <div
                key={tick.seq}
                data-testid={`tick-${tick.seq}`}
                data-seq={tick.seq}
                data-value={tick.value}
                {...(tick.alert ? { "data-alert": "true" } : {})}
                style={styles.tickRow(tick.alert)}
              >
                <span style={styles.tickSeq}>#{tick.seq}</span>
                <span style={styles.tickValue}>{tick.value}</span>
                {tick.alert && <span style={styles.alertBadge}>ALERT</span>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "32px 16px",
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "16px",
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: 0,
    color: "#111827",
  },
  statusBadge: (live: boolean) => ({
    padding: "6px 12px",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: "600",
    backgroundColor: live ? "#dcfce7" : "#f3f4f6",
    color: live ? "#166534" : "#4b5563",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }),
  controlsSection: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "24px",
    backgroundColor: "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: "24px",
    alignItems: "center",
  },
  controlGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#4b5563",
  },
  button: (start: boolean, active: boolean) => ({
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: active ? "not-allowed" : "pointer",
    border: "none",
    backgroundColor: start
      ? active
        ? "#e5e7eb"
        : "#2563eb"
      : active
      ? "#e5e7eb"
      : "#dc2626",
    color: active ? "#9ca3af" : "#ffffff",
    transition: "all 0.2s",
  }),
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    width: "120px",
    outline: "none",
  },
  applyButton: {
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    border: "none",
    backgroundColor: "#4b5563",
    color: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  card: (highlighted = false, isAlertCount = false) => ({
    backgroundColor: highlighted
      ? isAlertCount
        ? "#fee2e2"
        : "#fef2f2"
      : "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    border: highlighted
      ? `2px solid ${isAlertCount ? "#f87171" : "#ef4444"}`
      : "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "120px",
    textAlign: "center" as const,
  }),
  cardTitle: {
    fontSize: "13px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "#6b7280",
    margin: "0 0 8px 0",
  },
  metricValue: {
    fontSize: "36px",
    fontWeight: "bold",
    color: "#111827",
  },
  currentValueText: (over: boolean) => ({
    fontSize: "48px",
    fontWeight: "bold",
    color: over ? "#dc2626" : "#111827",
  }),
  thresholdIndicator: {
    fontSize: "12px",
    color: "#ef4444",
    fontWeight: "600",
    marginTop: "4px",
  },
  historySection: {
    backgroundColor: "#ffffff",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    border: "1px solid #e5e7eb",
  },
  historyTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    margin: "0 0 16px 0",
    color: "#111827",
  },
  historyContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    maxHeight: "400px",
    overflowY: "auto" as const,
    paddingRight: "4px",
  },
  emptyHistory: {
    textAlign: "center" as const,
    color: "#9ca3af",
    padding: "32px 0",
  },
  tickRow: (alert: boolean) => ({
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: "8px",
    backgroundColor: alert ? "#fee2e2" : "#f9fafb",
    border: `1px solid ${alert ? "#fca5a5" : "#e5e7eb"}`,
    gap: "16px",
  }),
  tickSeq: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#6b7280",
    width: "60px",
  },
  tickValue: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
  },
  alertBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "bold",
    backgroundColor: "#ef4444",
    color: "#ffffff",
  },
};
