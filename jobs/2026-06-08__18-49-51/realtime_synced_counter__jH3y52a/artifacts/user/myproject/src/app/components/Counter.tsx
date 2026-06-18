"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

interface CounterProps {
  roomId: string;
}

export const Counter = ({ roomId }: CounterProps) => {
  const [count, setCount] = useSyncedState<number>(0, "count", roomId);

  return (
    <div style={{ textAlign: "center", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Collaborative Counter</h1>
      <div style={{ fontSize: "4rem", fontWeight: "bold", margin: "1rem 0" }}>
        {count}
      </div>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <button
          onClick={() => setCount((c) => c - 1)}
          style={{
            fontSize: "1.5rem",
            padding: "0.5rem 1.5rem",
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "2px solid #333",
            background: "#fff",
          }}
        >
          Decrement
        </button>
        <button
          onClick={() => setCount((c) => c + 1)}
          style={{
            fontSize: "1.5rem",
            padding: "0.5rem 1.5rem",
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "2px solid #333",
            background: "#fff",
          }}
        >
          Increment
        </button>
      </div>
    </div>
  );
};
