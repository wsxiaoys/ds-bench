"use client";

import React, { useState, useEffect } from "react";

interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

interface MetricsState {
  running: boolean;
  seq: number;
  minValue: number | null;
  maxValue: number | null;
  alertCount: number;
  threshold: number | null;
  history: Tick[];
}

export function MetricsDashboard() {
  const [state, setState] = useState<MetricsState>({
    running: false,
    seq: 0,
    minValue: null,
    maxValue: null,
    alertCount: 0,
    threshold: null,
    history: [],
  });

  const [thresholdInput, setThresholdInput] = useState<string>("");

  useEffect(() => {
    // Connect to the SSE stream
    const eventSource = new EventSource("/api/metrics/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MetricsState;
        setState(data);
      } catch (e) {
        console.error("Failed to parse metrics stream data:", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Metrics stream connection error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStart = async () => {
    try {
      await fetch("/api/metrics/start", { method: "POST" });
    } catch (e) {
      console.error("Failed to start metrics stream:", e);
    }
  };

  const handleStop = async () => {
    try {
      await fetch("/api/metrics/stop", { method: "POST" });
    } catch (e) {
      console.error("Failed to stop metrics stream:", e);
    }
  };

  const handleApplyThreshold = async () => {
    try {
      const parsed = parseFloat(thresholdInput);
      const threshold = isNaN(parsed) ? null : parsed;
      await fetch("/api/metrics/threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      });
    } catch (e) {
      console.error("Failed to apply threshold:", e);
    }
  };

  const latestTick = state.history[0];
  const latestValue = latestTick ? latestTick.value : null;
  const isOver =
    latestValue !== null &&
    state.threshold !== null &&
    latestValue > state.threshold;

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ borderBottom: "2px solid #eaeaea", paddingBottom: "10px" }}>
        Live Server-Driven Metrics Dashboard
      </h1>

      {/* Controls Section */}
      <section style={{ margin: "20px 0", padding: "15px", backgroundColor: "#f9f9f9", borderRadius: "5px" }}>
        <h2>Controls</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            data-testid="start-stream"
            onClick={handleStart}
            style={{
              padding: "10px 15px",
              backgroundColor: state.running ? "#ccc" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Start Stream
          </button>
          <button
            data-testid="stop-stream"
            onClick={handleStop}
            style={{
              padding: "10px 15px",
              backgroundColor: !state.running ? "#ccc" : "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Stop Stream
          </button>

          <div style={{ display: "flex", gap: "5px", alignItems: "center", marginLeft: "auto" }}>
            <label htmlFor="threshold-input" style={{ fontWeight: "bold" }}>Threshold:</label>
            <input
              id="threshold-input"
              data-testid="threshold-input"
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="e.g. 50"
              style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", width: "100px" }}
            />
            <button
              data-testid="apply-threshold"
              onClick={handleApplyThreshold}
              style={{
                padding: "10px 15px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Apply Threshold
            </button>
          </div>
        </div>
        <div style={{ marginTop: "10px", fontSize: "0.9em", color: "#666" }}>
          Current Active Threshold: {state.threshold !== null ? <strong>{state.threshold}</strong> : "None"} | Status: {state.running ? <span style={{ color: "green", fontWeight: "bold" }}>Running</span> : <span style={{ color: "red", fontWeight: "bold" }}>Stopped</span>}
        </div>
      </section>

      {/* Widgets Section */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", margin: "20px 0" }}>
        <div style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", textAlign: "center", backgroundColor: isOver ? "#ffebee" : "#fff" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9em", textTransform: "uppercase", color: "#666" }}>
            Current Value
          </h3>
          <div
            data-testid="current-value"
            {...(isOver ? { "data-over": "true" } : {})}
            style={{
              fontSize: "2.5em",
              fontWeight: "bold",
              color: isOver ? "#d32f2f" : "#333",
            }}
          >
            {latestValue !== null ? latestValue : ""}
          </div>
          {isOver && (
            <div style={{ color: "#d32f2f", fontSize: "0.8em", fontWeight: "bold", marginTop: "5px" }}>
              OVER THRESHOLD!
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9em", textTransform: "uppercase", color: "#666" }}>
            Tick Count
          </h3>
          <div
            data-testid="tick-count"
            style={{ fontSize: "2.5em", fontWeight: "bold", color: "#333" }}
          >
            {state.seq}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9em", textTransform: "uppercase", color: "#666" }}>
            Min Value
          </h3>
          <div
            data-testid="min-value"
            style={{ fontSize: "2.5em", fontWeight: "bold", color: "#333" }}
          >
            {state.minValue !== null ? state.minValue : ""}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9em", textTransform: "uppercase", color: "#666" }}>
            Max Value
          </h3>
          <div
            data-testid="max-value"
            style={{ fontSize: "2.5em", fontWeight: "bold", color: "#333" }}
          >
            {state.maxValue !== null ? state.maxValue : ""}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: "5px", padding: "15px", textAlign: "center", backgroundColor: state.alertCount > 0 ? "#fff3e0" : "#fff" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "0.9em", textTransform: "uppercase", color: "#666" }}>
            Alert Count
          </h3>
          <div
            data-testid="alert-count"
            style={{ fontSize: "2.5em", fontWeight: "bold", color: state.alertCount > 0 ? "#f57c00" : "#333" }}
          >
            {state.alertCount}
          </div>
        </div>
      </section>

      {/* History Section */}
      <section style={{ margin: "30px 0" }}>
        <h2>Scrolling Tick History (Last 100 Ticks)</h2>
        <div
          data-testid="history"
          style={{
            border: "1px solid #ddd",
            borderRadius: "5px",
            maxHeight: "300px",
            overflowY: "auto",
            backgroundColor: "#fff",
          }}
        >
          {state.history.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
              No ticks emitted yet. Press "Start Stream" to begin.
            </div>
          ) : (
            state.history.map((tick) => (
              <div
                key={tick.seq}
                data-testid={`tick-${tick.seq}`}
                data-seq={tick.seq}
                data-value={tick.value}
                {...(tick.alert ? { "data-alert": "true" } : {})}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 15px",
                  borderBottom: "1px solid #eee",
                  backgroundColor: tick.alert ? "#ffebee" : "transparent",
                  color: tick.alert ? "#c62828" : "#333",
                }}
              >
                <span>
                  <strong>Tick #{tick.seq}</strong>
                </span>
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>{tick.value}</span>
                  {tick.alert && (
                    <span
                      style={{
                        fontSize: "0.75em",
                        backgroundColor: "#c62828",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontWeight: "bold",
                      }}
                    >
                      ALERT
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
