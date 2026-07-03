import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generations = useQuery(api.ai.list);
  const generateAction = useAction(api.ai.generate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      await generateAction({ prompt: prompt.trim() });
      setPrompt("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate AI response.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>Convex AI Integration</h1>
        <p>Ask the AI anything and see the reactive updates!</p>
      </header>

      <main className="app-main">
        <section className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="prompt">Enter a Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type your prompt here..."
                disabled={isGenerating}
                rows={4}
                required
              />
            </div>
            <button type="submit" className="submit-btn" disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? "Generating..." : "Submit Prompt"}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="results-section">
          <h2>Generated Results</h2>
          {generations === undefined ? (
            <div className="loading">Loading generations...</div>
          ) : generations.length === 0 ? (
            <div className="empty">No generations yet. Try submitting a prompt!</div>
          ) : (
            <div className="generations-list">
              {[...generations].reverse().map((gen) => (
                <div key={gen._id} className="generation-card">
                  <div className="generation-prompt">
                    <strong>Prompt:</strong> {gen.prompt}
                  </div>
                  <div className="generation-result">
                    <strong>Result:</strong>
                    <p>{gen.result}</p>
                  </div>
                  <div className="generation-time">
                    <small>Created: {new Date(gen._creationTime).toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
