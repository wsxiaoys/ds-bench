"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Counter({ roomId, initialCount }: { roomId: string; initialCount: number }) {
  const [count, setCount] = useSyncedState(initialCount, "count", roomId);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      backgroundColor: "#f9fafb",
      color: "#1f2937"
    }}>
      <div style={{
        padding: "2rem",
        borderRadius: "1rem",
        backgroundColor: "white",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        textAlign: "center"
      }}>
        <h1 style={{ margin: "0 0 1rem 0", fontSize: "1.5rem" }}>Collaborative Counter</h1>
        <div style={{ fontSize: "4rem", fontWeight: "bold", margin: "1rem 0" }} id="count-display">
          {count ?? 0}
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setCount((prev) => (prev ?? 0) + 1)}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              fontWeight: "600",
              color: "white",
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer"
            }}
          >
            Increment
          </button>
          <button
            onClick={() => setCount((prev) => (prev ?? 0) - 1)}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              fontWeight: "600",
              color: "white",
              backgroundColor: "#dc2626",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer"
            }}
          >
            Decrement
          </button>
        </div>
      </div>
    </div>
  );
}
