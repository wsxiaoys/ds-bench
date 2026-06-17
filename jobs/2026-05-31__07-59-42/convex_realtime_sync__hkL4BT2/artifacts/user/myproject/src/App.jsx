import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

function App() {
  const runId = import.meta.env.VITE_RUN_ID;
  const counter = useQuery(api.counters.getByRunId, { runId });
  const increment = useMutation(api.counters.increment);

  return (
    <>
      <section id="center">
        <div>
          <h1>Collaborative Counter</h1>
          <p>
            Run ID: <code>{runId}</code>
          </p>
        </div>
        <p>
          Count: {counter ? counter.count : 0}
        </p>
        <button
          type="button"
          className="counter"
          onClick={() => increment({ runId })}
        >
          Increment
        </button>
      </section>
    </>
  )
}

export default App