import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

function App() {
  const runId = import.meta.env.VITE_RUN_ID || ''
  const counter = useQuery(api.counter.get, { runId })
  const increment = useMutation(api.counter.increment)

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Counter</h1>
      <p>Count: {counter?.count ?? '...'}</p>
      <button onClick={() => increment({ runId })}>Increment</button>
    </div>
  )
}

export default App
