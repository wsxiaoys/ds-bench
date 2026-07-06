import { useState } from "react";
import type { FormEvent } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generations = useQuery(api.ai.list) ?? [];
  const generate = useAction(api.ai.generate);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      await generate({ prompt: trimmed });
      setPrompt("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate a response.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Convex AI Playground</h1>
        <p>
          Enter a prompt below. It is sent to a Convex action that calls the
          OpenAI API and stores the response in the <code>generations</code>{" "}
          table.
        </p>
      </header>

      <form className="prompt-form" onSubmit={handleSubmit}>
        <input
          className="prompt-input"
          type="text"
          placeholder="Ask anything..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          aria-label="Prompt"
        />
        <button
          className="prompt-submit"
          type="submit"
          disabled={isGenerating || prompt.trim().length === 0}
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
      </form>

      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="results">
        <h2>Generations</h2>
        {generations.length === 0 ? (
          <p className="empty">No generations yet. Submit a prompt above.</p>
        ) : (
          <ul className="results__list">
            {generations.map((entry) => (
              <li key={entry._id} className="results__item">
                <div className="results__prompt">
                  <span className="results__label">Prompt:</span> {entry.prompt}
                </div>
                <div className="results__answer">
                  <span className="results__label">Result:</span>{" "}
                  {entry.result}
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