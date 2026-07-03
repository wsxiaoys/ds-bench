import { SharedCounter } from "@/app/components/SharedCounter";

export const CounterPage = () => {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Shared Counter</h1>
      <p>
        This counter is synced in realtime across all connected clients using
        RedwoodSDK's <code>useSyncedState</code> hook.
      </p>
      <SharedCounter />
    </div>
  );
};