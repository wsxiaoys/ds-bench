import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const generations = useQuery(api.ai.list);
  const generate = useAction(api.ai.generate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      await generate({ prompt });
      setPrompt("");
    } catch (error) {
      console.error("Failed to generate:", error);
      alert("Failed to generate result. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Convex AI Integration</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt..."
            style={{ flex: 1, padding: "0.5rem" }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !prompt.trim()}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>

      <section>
        <h2>Generations</h2>
        {generations === undefined ? (
          <p>Loading...</p>
        ) : generations.length === 0 ? (
          <p>No generations yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {generations.map((gen) => (
              <li
                key={gen._id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <strong>Prompt:</strong> {gen.prompt}
                <div style={{ marginTop: "0.5rem" }}>
                  <strong>Result:</strong> {gen.result}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
