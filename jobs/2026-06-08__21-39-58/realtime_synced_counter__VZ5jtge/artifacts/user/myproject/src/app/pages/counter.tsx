"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export const Counter = ({ runId }: { runId: string }) => {
  const [count, setCount] = useSyncedState<number>(0, "counter", runId);

  return (
    <div>
      <p>
        Count: <span id="count-value">{count}</span>
      </p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
    </div>
  );
};
