"use client";

import React, { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export function MetricsDashboard() {
  const [isRunning, setIsRunning] = useSyncedState(false, "isRunning");
  const [ticks, setTicks] = useSyncedState<any[]>([], "ticks");
  const [tickCount, setTickCount] = useSyncedState(0, "tickCount");
  const [minVal, setMinVal] = useSyncedState<number | null>(null, "minVal");
  const [maxVal, setMaxVal] = useSyncedState<number | null>(null, "maxVal");
  const [alertCount, setAlertCount] = useSyncedState(0, "alertCount");
  const [threshold, setThreshold] = useSyncedState<number | null>(null, "threshold");

  const [inputValue, setInputValue] = useState("");

  const handleApplyThreshold = () => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val)) {
      setThreshold(val);
    }
  };

  const latestTick = ticks && ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const isOver = latestTick && threshold !== null && threshold !== undefined && latestTick.value > threshold;

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1.5rem" }}>Metrics Dashboard</h1>
      
      {/* Controls */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          data-testid="start-stream"
          onClick={() => setIsRunning(true)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: isRunning ? "#10B981" : "#3B82F6",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Start Stream
        </button>
        <button
          data-testid="stop-stream"
          onClick={() => setIsRunning(false)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#EF4444",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Stop Stream
        </button>
        
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="number"
            data-testid="threshold-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Threshold"
            style={{
              padding: "0.5rem",
              border: "1px solid #D1D5DB",
              borderRadius: "0.25rem",
              width: "120px"
            }}
          />
          <button
            data-testid="apply-threshold"
            onClick={handleApplyThreshold}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#4B5563",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Apply Threshold
          </button>
        </div>
      </div>

      {/* Threshold Status */}
      <div style={{ marginBottom: "1.5rem", color: "#4B5563" }}>
        Current Threshold: <strong>{threshold !== null ? threshold : "None"}</strong>
      </div>

      {/* Widgets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: "#6B7280", textTransform: "uppercase" }}>Current Value</div>
          <div
            data-testid="current-value"
            {...(isOver ? { "data-over": "true" } : {})}
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: isOver ? "#EF4444" : "#111827",
              transition: "color 0.2s"
            }}
          >
            {latestTick ? latestTick.value : ""}
          </div>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: "#6B7280", textTransform: "uppercase" }}>Tick Count</div>
          <div data-testid="tick-count" style={{ fontSize: "2rem", fontWeight: "bold", color: "#111827" }}>
            {tickCount}
          </div>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: "#6B7280", textTransform: "uppercase" }}>Min Value</div>
          <div data-testid="min-value" style={{ fontSize: "2rem", fontWeight: "bold", color: "#111827" }}>
            {minVal !== null ? minVal : ""}
          </div>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: "#6B7280", textTransform: "uppercase" }}>Max Value</div>
          <div data-testid="max-value" style={{ fontSize: "2rem", fontWeight: "bold", color: "#111827" }}>
            {maxVal !== null ? maxVal : ""}
          </div>
        </div>
        <div style={{ padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: "#6B7280", textTransform: "uppercase" }}>Alert Count</div>
          <div data-testid="alert-count" style={{ fontSize: "2rem", fontWeight: "bold", color: "#EF4444" }}>
            {alertCount}
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Recent Ticks</h2>
        <div
          data-testid="history"
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "0.5rem",
            maxHeight: "300px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
            gap: "0.5rem"
          }}
        >
          {ticks && ticks.map((tick) => (
            <div
              key={tick.seq}
              data-testid={`tick-${tick.seq}`}
              data-seq={tick.seq}
              data-value={tick.value}
              {...(tick.isAlert ? { "data-alert": "true" } : {})}
              style={{
                padding: "0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: tick.isAlert ? "#FEE2E2" : "#F3F4F6",
                color: tick.isAlert ? "#991B1B" : "#1F2937",
                border: tick.isAlert ? "1px solid #F87171" : "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span>Sequence #{tick.seq}</span>
              <strong>{tick.value} {tick.isAlert && "(ALERT)"}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
