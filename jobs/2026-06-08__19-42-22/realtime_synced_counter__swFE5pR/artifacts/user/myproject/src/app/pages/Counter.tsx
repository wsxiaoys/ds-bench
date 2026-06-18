"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Counter({ roomId }: { roomId: string }) {
  const [count, setCount] = useSyncedState(0, "count", roomId);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
    </div>
  );
}
