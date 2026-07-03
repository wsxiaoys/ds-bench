import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/_generated/api"

function App() {
  const runId = import.meta.env.VITE_RUN_ID
  const counter = useQuery(api.counters.get, { runId })
  const increment = useMutation(api.counters.increment)

  const count = counter === undefined ? "Loading..." : (counter?.count ?? 0)

  const handleIncrement = async () => {
    try {
      await increment({ runId })
    } catch (err) {
      console.error("Failed to increment count:", err)
    }
  }

  return (
    <div style={{ textAlign: "center", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Collaborative Counter</h1>
      <p>Run ID: <code>{runId}</code></p>
      <div style={{ fontSize: "3rem", margin: "2rem 0", fontWeight: "bold" }}>
        {count}
      </div>
      <button
        onClick={handleIncrement}
        style={{
          fontSize: "1.5rem",
          padding: "0.75rem 1.5rem",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #ccc",
          backgroundColor: "#f0f0f0"
        }}
      >
        Increment
      </button>
    </div>
  )
}

export default App
