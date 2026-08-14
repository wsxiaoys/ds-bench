"use client";

import React, { useState, useEffect } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

export function MetricsPage() {
  const [isRunning, setIsRunning] = useSyncedState<boolean>(false, "isRunning");
  const [currentValue, setCurrentValue] = useSyncedState<number | null>(null, "currentValue");
  const [tickCount, setTickCount] = useSyncedState<number>(0, "tickCount");
  const [minValue, setMinValue] = useSyncedState<number | null>(null, "minValue");
  const [maxValue, setMaxValue] = useSyncedState<number | null>(null, "maxValue");
  const [alertCount, setAlertCount] = useSyncedState<number>(0, "alertCount");
  const [threshold, setThreshold] = useSyncedState<number | null>(null, "threshold");
  const [history, setHistory] = useSyncedState<Tick[]>([], "history");

  const [inputValue, setInputValue] = useState<string>("");

  // Sync the local input value with the active threshold when it changes on the server
  useEffect(() => {
    if (threshold !== null && threshold !== undefined) {
      setInputValue(threshold.toString());
    }
  }, [threshold]);

  const handleApplyThreshold = () => {
    const val = inputValue.trim();
    if (val === "") {
      setThreshold(null);
    } else {
      const num = Number(val);
      if (!isNaN(num)) {
        setThreshold(num);
      }
    }
  };

  const isOver = currentValue !== null && threshold !== null && threshold !== undefined && currentValue > threshold;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Live Metrics Dashboard</h1>

      {/* Controls */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          data-testid="start-stream"
          onClick={() => setIsRunning(true)}
          disabled={isRunning}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Start Stream
        </button>
        <button
          data-testid="stop-stream"
          onClick={() => setIsRunning(false)}
          disabled={!isRunning}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Stop Stream
        </button>
        <div style={{ marginLeft: "20px", display: "flex", gap: "5px", alignItems: "center" }}>
          <label htmlFor="threshold-input">Threshold:</label>
          <input
            id="threshold-input"
            type="number"
            data-testid="threshold-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ padding: "6px", width: "100px" }}
          />
          <button
            data-testid="apply-threshold"
            onClick={handleApplyThreshold}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Apply Threshold
          </button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: "20px" }}>
        Status: <strong>{isRunning ? "Running" : "Stopped"}</strong>
        {threshold !== null && threshold !== undefined && (
          <span style={{ marginLeft: "20px" }}>
            Active Threshold: <strong>{threshold}</strong>
          </span>
        )}
      </div>

      {/* Widgets Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", marginBottom: "30px" }}>
        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", backgroundColor: isOver ? "#ffebee" : "#f9f9f9" }}>
          <h3>Latest Value</h3>
          <div
            data-testid="current-value"
            {...(isOver ? { "data-over": "true" } : {})}
            style={{ fontSize: "2rem", fontWeight: "bold", color: isOver ? "#c62828" : "#333" }}
          >
            {currentValue !== null ? currentValue : "-"}
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>
          <h3>Tick Count</h3>
          <div data-testid="tick-count" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {tickCount}
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>
          <h3>Min Value</h3>
          <div data-testid="min-value" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {minValue !== null ? minValue : "-"}
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>
          <h3>Max Value</h3>
          <div data-testid="max-value" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {maxValue !== null ? maxValue : "-"}
          </div>
        </div>

        <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>
          <h3>Alert Count</h3>
          <div data-testid="alert-count" style={{ fontSize: "2rem", fontWeight: "bold", color: alertCount > 0 ? "#c62828" : "#333" }}>
            {alertCount}
          </div>
        </div>
      </div>

      {/* Scrolling History */}
      <h2>Tick History</h2>
      <div
        data-testid="history"
        style={{
          border: "1px solid #ccc",
          borderRadius: "4px",
          maxHeight: "300px",
          overflowY: "auto",
          padding: "10px",
          backgroundColor: "#fff",
        }}
      >
        {history.length === 0 ? (
          <div style={{ color: "#888", fontStyle: "italic" }}>No ticks emitted yet.</div>
        ) : (
          history.map((tick) => {
            const isAlert = tick.alert;
            const extraAttrs = isAlert ? { "data-alert": "true" } : {};
            return (
              <div
                key={tick.seq}
                data-testid={`tick-${tick.seq}`}
                data-seq={tick.seq}
                data-value={tick.value}
                {...extraAttrs}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #eee",
                  backgroundColor: isAlert ? "#ffebee" : "transparent",
                  color: isAlert ? "#c62828" : "#333",
                  fontWeight: isAlert ? "bold" : "normal",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Tick #{tick.seq}</span>
                <span>Value: {tick.value} {isAlert ? "(ALERT)" : ""}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
