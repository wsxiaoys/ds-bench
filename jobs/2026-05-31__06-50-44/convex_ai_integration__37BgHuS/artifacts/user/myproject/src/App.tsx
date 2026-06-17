import { type FormEvent, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generations = useQuery(api.ai.list);
  const generate = useAction(api.ai.generate);

  const orderedGenerations = useMemo(() => {
    if (!generations) {
      return [];
    }
    return [...generations].reverse();
  }, [generations]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    try {
      await generate({ prompt: trimmedPrompt });
      setPrompt("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate response";
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app">
      <header>
        <h1>Convex + OpenAI Generations</h1>
        <p>Submit a prompt and store the result in Convex.</p>
      </header>

      <form className="prompt-form" onSubmit={handleSubmit}>
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          name="prompt"
          placeholder="Ask the model anything..."
          rows={4}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting || !prompt.trim()}>
          {isSubmitting ? "Generating..." : "Generate"}
        </button>
        {status && <p className="status error">{status}</p>}
      </form>

      <section className="results">
        <h2>Generations</h2>
        {!generations && <p className="status">Loading generations...</p>}
        {generations && generations.length === 0 && (
          <p className="status">No generations yet. Submit a prompt above.</p>
        )}
        <ul>
          {orderedGenerations.map((generation) => (
            <li key={generation._id}>
              <h3>Prompt</h3>
              <p className="prompt">{generation.prompt}</p>
              <h3>Result</h3>
              <p className="result">{generation.result}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
