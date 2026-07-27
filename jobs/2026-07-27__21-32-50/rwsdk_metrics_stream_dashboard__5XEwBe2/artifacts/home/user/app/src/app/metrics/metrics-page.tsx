"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MetricsState, Tick } from "./metrics-do";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWebSocketUrl(): string {
  // In dev, the worker runs on the same origin
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/metrics/ws`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function MetricsPage() {
  const [state, setState] = useState<MetricsState>({
    running: false,
    seq: 0,
    tickCount: 0,
    minValue: null,
    maxValue: null,
    alertCount: 0,
    threshold: null,
    history: [],
  });
  const [thresholdInput, setThresholdInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  // Connect to WebSocket for live state
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.kind === "state" && data.state) {
            setState(data.state);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        // Reconnect after 1 second
        setTimeout(() => {
          if (mountedRef.current) connect();
        }, 1000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    try {
      const resp = await fetch("/metrics/start", { method: "POST" });
      await resp.json();
    } catch (e) {
      console.error("Start failed:", e);
    }
  }, []);

  const handleStop = useCallback(async () => {
    try {
      const resp = await fetch("/metrics/stop", { method: "POST" });
      await resp.json();
    } catch (e) {
      console.error("Stop failed:", e);
    }
  }, []);

  const handleApplyThreshold = useCallback(async () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val)) return;
    try {
      const resp = await fetch("/metrics/set-threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: val }),
      });
      await resp.json();
    } catch (e) {
      console.error("Set threshold failed:", e);
    }
  }, [thresholdInput]);

  // ── Derived values ─────────────────────────────────────────────────────

  const latestTick: Tick | null =
    state.history.length > 0 ? state.history[0] : null;

  const isOverThreshold =
    state.threshold !== null &&
    latestTick !== null &&
    latestTick.value > state.threshold;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Metrics Dashboard</h1>

      {/* Controls */}
      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button
          data-testid="start-stream"
          onClick={handleStart}
          disabled={state.running}
          style={{ padding: "0.5rem 1rem", cursor: state.running ? "not-allowed" : "pointer" }}
        >
          Start Stream
        </button>
        <button
          data-testid="stop-stream"
          onClick={handleStop}
          disabled={!state.running}
          style={{ padding: "0.5rem 1rem", cursor: !state.running ? "not-allowed" : "pointer" }}
        >
          Stop Stream
        </button>
        <input
          data-testid="threshold-input"
          type="number"
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          placeholder="Threshold"
          style={{ padding: "0.5rem", width: "120px" }}
        />
        <button
          data-testid="apply-threshold"
          onClick={handleApplyThreshold}
          style={{ padding: "0.5rem 1rem" }}
        >
          Apply Threshold
        </button>
      </div>

      {/* Widgets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Current Value</div>
          <div
            data-testid="current-value"
            {...(isOverThreshold ? { "data-over": "true" } : {})}
            style={{ fontSize: "2rem", fontWeight: "bold", color: isOverThreshold ? "#e53e3e" : "#333" }}
          >
            {latestTick !== null ? latestTick.value : "-"}
          </div>
        </div>
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Tick Count</div>
          <div data-testid="tick-count" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {state.tickCount}
          </div>
        </div>
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Min Value</div>
          <div data-testid="min-value" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {state.minValue !== null ? state.minValue : "-"}
          </div>
        </div>
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Max Value</div>
          <div data-testid="max-value" style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {state.maxValue !== null ? state.maxValue : "-"}
          </div>
        </div>
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Alert Count</div>
          <div data-testid="alert-count" style={{ fontSize: "2rem", fontWeight: "bold", color: "#e53e3e" }}>
            {state.alertCount}
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Recent Ticks</h2>
        <div
          data-testid="history"
          style={{
            border: "1px solid #ccc",
            borderRadius: "8px",
            maxHeight: "400px",
            overflowY: "auto",
            padding: "0.5rem",
          }}
        >
          {state.history.length === 0 ? (
            <div style={{ color: "#999", padding: "1rem", textAlign: "center" }}>
              No ticks yet. Start the stream to begin.
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
                  padding: "0.4rem 0.5rem",
                  borderBottom: "1px solid #eee",
                  backgroundColor: tick.alert ? "#fff5f5" : "transparent",
                  borderRadius: tick.alert ? "4px" : undefined,
                }}
              >
                <span style={{ fontWeight: "bold" }}>#{tick.seq}</span>
                <span style={{ color: tick.alert ? "#e53e3e" : "#333" }}>
                  {tick.value}
                  {tick.alert ? " ⚠" : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
