import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

const runId = import.meta.env.VITE_RUN_ID

if (!runId) {
  throw new Error('Missing VITE_RUN_ID in environment')
}

function App() {
  const counter = useQuery(api.counter.get, { runId })
  const increment = useMutation(api.counter.increment)

  const count = counter?.count ?? 0
  const isLoading = counter === undefined

  return (
    <main className="app">
      <h1>Collaborative Counter</h1>
      <p className="run-id">Run ID: {runId}</p>
      <div className="count">{isLoading ? 'Loading...' : count}</div>
      <button
        type="button"
        className="increment"
        onClick={() => increment({ runId })}
        disabled={isLoading}
      >
        Increment
      </button>
    </main>
  )
}

export default App
