import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const runId = import.meta.env.VITE_RUN_ID;
  const count = useQuery(api.counter.get, { runId }) ?? 0;
  const increment = useMutation(api.counter.increment);

  return (
    <div className="app">
      <h1>Collaborative Counter</h1>
      <p>Run ID: {runId}</p>
      <div className="card">
        <p>Current count: {count}</p>
        <button onClick={() => increment({ runId })}>
          Increment
        </button>
      </div>
    </div>
  );
}

export default App;
