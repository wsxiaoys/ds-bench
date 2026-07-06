import { SharedCounter } from "../components/SharedCounter.js";

export const CounterPage = () => {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Shared Counter</h1>
      <SharedCounter />
    </main>
  );
};

export default CounterPage;
