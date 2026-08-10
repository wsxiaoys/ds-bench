"use client";

import { useEffect, useRef, useState } from "react";

type Tick = {
  seq: number;
  value: number;
  alert: boolean;
};

type MetricsState = {
  running: boolean;
  seq: number;
  tickCount: number;
  min: number | null;
  max: number | null;
  alertCount: number;
  threshold: number | null;
  history: Tick[];
};

const POLL_INTERVAL_MS = 400;

export function MetricsDashboard({
  initialState,
}: {
  initialState: MetricsState;
}) {
  const [state, setState] = useState<MetricsState>(initialState);
  const [thresholdInput, setThresholdInput] = useState<string>("");
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/metrics/api/state", {
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data: MetricsState = await res.json();
          setState(data);
        }
      } catch {
        // Ignore transient network errors; the next poll will retry.
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleStart() {
    const res = await fetch("/metrics/api/start", { method: "POST" });
    if (res.ok) {
      setState(await res.json());
    }
  }

  async function handleStop() {
    const res = await fetch("/metrics/api/stop", { method: "POST" });
    if (res.ok) {
      setState(await res.json());
    }
  }

  async function handleApplyThreshold() {
    const value = Number(thresholdInput);
    if (!Number.isFinite(value)) {
      return;
    }
    const res = await fetch("/metrics/api/threshold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threshold: value }),
    });
    if (res.ok) {
      setState(await res.json());
    }
  }

  const history = state.history;
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const currentValue = latest ? latest.value : 0;
  const isOver =
    latest !== null &&
    state.threshold !== null &&
    latest.value > state.threshold;

  const orderedHistory = [...history].reverse();

  return (
    <div>
      <h1>Metrics Dashboard</h1>

      <section
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button data-testid="start-stream" onClick={handleStart}>
          Start
        </button>
        <button data-testid="stop-stream" onClick={handleStop}>
          Stop
        </button>
        <input
          data-testid="threshold-input"
          type="number"
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          placeholder="Threshold"
        />
        <button data-testid="apply-threshold" onClick={handleApplyThreshold}>
          Apply Threshold
        </button>
        <span>
          Status: {state.running ? "running" : "stopped"}
          {state.threshold !== null ? ` · threshold ${state.threshold}` : ""}
        </span>
      </section>

      <section
        style={{
          display: "flex",
          gap: "1.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div>Current Value</div>
          <div
            data-testid="current-value"
            data-over={isOver ? "true" : undefined}
            style={{ fontSize: "1.5rem", fontWeight: "bold" }}
          >
            {currentValue}
          </div>
        </div>
        <div>
          <div>Tick Count</div>
          <div data-testid="tick-count" style={{ fontSize: "1.5rem" }}>
            {state.tickCount}
          </div>
        </div>
        <div>
          <div>Min</div>
          <div data-testid="min-value" style={{ fontSize: "1.5rem" }}>
            {state.min ?? 0}
          </div>
        </div>
        <div>
          <div>Max</div>
          <div data-testid="max-value" style={{ fontSize: "1.5rem" }}>
            {state.max ?? 0}
          </div>
        </div>
        <div>
          <div>Alerts</div>
          <div data-testid="alert-count" style={{ fontSize: "1.5rem" }}>
            {state.alertCount}
          </div>
        </div>
      </section>

      <section>
        <h2>History</h2>
        <div
          data-testid="history"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {orderedHistory.map((tick) => (
            <div
              key={tick.seq}
              data-testid={`tick-${tick.seq}`}
              data-seq={tick.seq}
              data-value={tick.value}
              data-alert={tick.alert ? "true" : undefined}
              style={{
                display: "flex",
                gap: "0.75rem",
                fontFamily: "monospace",
              }}
            >
              <span>#{tick.seq}</span>
              <span>{tick.value}</span>
              {tick.alert ? <span>ALERT</span> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
