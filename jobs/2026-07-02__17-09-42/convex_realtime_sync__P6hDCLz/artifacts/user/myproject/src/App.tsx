import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

// The run-id is injected at build/dev time from /logs/artifacts/run-id.
// This isolates the counter state for each run/session.
const RUN_ID = import.meta.env.VITE_RUN_ID as string

function App() {
  // Reactive query that re-runs whenever the counter changes.
  const count = useQuery(api.counter.getCount, { runId: RUN_ID }) ?? 0
  const increment = useMutation(api.counter.increment)

  const handleIncrement = () => {
    void increment({ runId: RUN_ID })
  }

  return (
    <div className="app">
      <header>
        <h1>Collaborative Counter</h1>
        <p className="subtitle">
          Powered by React + Convex. Open this page in another tab and try it!
        </p>
      </header>
      <main className="counter-card">
        <div className="count-display" data-testid="count">
          {count}
        </div>
        <button
          type="button"
          className="increment-button"
          onClick={handleIncrement}
        >
          Increment
        </button>
        <p className="run-id">Run ID: {RUN_ID}</p>
      </main>
    </div>
  )
}

export default App