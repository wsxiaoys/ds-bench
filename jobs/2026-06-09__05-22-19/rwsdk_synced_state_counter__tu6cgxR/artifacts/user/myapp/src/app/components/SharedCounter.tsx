"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function SharedCounter() {
  const [count, setCount] = useSyncedState(0, "counter");

  return (
    <div>
      <p data-testid="counter-value">Count: {count}</p>
      <button data-testid="inc-btn" onClick={() => setCount((c) => c + 1)}>
        Increment
      </button>
      <button data-testid="reset-btn" onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}