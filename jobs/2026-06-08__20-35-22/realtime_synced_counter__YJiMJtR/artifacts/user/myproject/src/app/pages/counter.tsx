"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Counter({ roomId }: { roomId: string }) {
  const [count, setCount] = useSyncedState(0, "counter", roomId);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px" }}>
      <h1>Collaborative Counter</h1>
      <p style={{ fontSize: "48px", fontWeight: "bold", margin: "0" }}>{count}</p>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => setCount((prev: number) => prev - 1)} style={{ fontSize: "18px", padding: "8px 24px", cursor: "pointer" }}>
          Decrement
        </button>
        <button onClick={() => setCount((prev: number) => prev + 1)} style={{ fontSize: "18px", padding: "8px 24px", cursor: "pointer" }}>
          Increment
        </button>
      </div>
    </div>
  );
}