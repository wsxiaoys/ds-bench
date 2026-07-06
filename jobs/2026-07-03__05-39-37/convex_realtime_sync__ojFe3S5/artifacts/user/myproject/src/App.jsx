import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const runId = import.meta.env.VITE_RUN_ID;
  const counter = useQuery(api.counter.getCounter, { runId });
  const increment = useMutation(api.counter.increment);

  const count = counter?.count ?? 0;

  const handleIncrement = () => {
    increment({ runId });
  };

  return (
    <section id="center">
      <h1>Collaborative Counter</h1>
      <p>Shared across all clients in real time.</p>
      <div className="count-display">{count}</div>
      <button type="button" className="counter" onClick={handleIncrement}>
        Increment
      </button>
    </section>
  );
}

export default App;