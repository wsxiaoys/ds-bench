import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listPolls } from "../lib/db";

const fetchPolls = createServerFn({ method: "GET" }).handler(() => {
  return listPolls();
});

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: async () => await fetchPolls(),
});

function HomePage() {
  const polls = Route.useLoaderData();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => setOptions((prev) => [...prev, ""]);

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create poll.");
        return;
      }
      setQuestion("");
      setOptions(["", ""]);
      router.navigate({ to: "/poll/$id", params: { id: data.id } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Polls</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Create a new poll</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              type="text"
              placeholder="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>
          {options.map((opt, i) => (
            <div key={i} style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                style={{ flex: 1, padding: "0.5rem", boxSizing: "border-box" }}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" onClick={addOption} style={{ marginRight: "0.5rem" }}>
              Add option
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create poll"}
            </button>
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </section>

      <section>
        <h2>Existing polls</h2>
        {polls.length === 0 && <p>No polls yet. Create the first one above!</p>}
        <ul>
          {polls.map((poll) => (
            <li key={poll.id} style={{ marginBottom: "0.25rem" }}>
              <Link to="/poll/$id" params={{ id: poll.id }}>
                {poll.question}
              </Link>{" "}
              ({poll.totalVotes} votes)
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
