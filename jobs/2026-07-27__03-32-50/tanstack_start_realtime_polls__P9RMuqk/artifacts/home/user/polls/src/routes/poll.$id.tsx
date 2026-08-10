import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { getPollById, type Poll } from "../lib/db";

const fetchPollById = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => {
    return getPollById(id);
  });

export const Route = createFileRoute("/poll/$id")({
  component: PollPage,
  loader: async ({ params }) => {
    const poll = await fetchPollById({ data: params.id });
    if (!poll) {
      throw notFound();
    }
    return poll;
  },
  notFoundComponent: () => (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <p>
        <Link to="/">&larr; Back to all polls</Link>
      </p>
      <h1>Poll not found</h1>
    </div>
  ),
});

const POLL_INTERVAL_MS = 1000;

function PollPage() {
  const initialPoll = Route.useLoaderData();
  const { id } = Route.useParams();

  const [poll, setPoll] = useState<Poll>(initialPoll);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPoll(initialPoll);
  }, [initialPoll]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/polls/${id}`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as Poll;
          setPoll(data);
        }
      } catch {
        // ignore transient network errors; we'll retry on the next tick
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const handleVote = useCallback(
    async (optionId: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/polls/${id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId }),
        });

        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "You have already voted on this poll.");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Something went wrong. Please try again.");
          return;
        }

        const data = (await res.json()) as Poll;
        setPoll(data);
      } catch {
        setError("Network error. Please try again.");
      }
    },
    [id],
  );

  const total = poll.totalVotes;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <p>
        <Link to="/">&larr; Back to all polls</Link>
      </p>
      <h1>{poll.question}</h1>
      <p data-testid="total-votes">Total votes: {total}</p>

      {error && (
        <p data-testid="vote-error" style={{ color: "red", fontWeight: "bold" }}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {poll.options.map((option) => {
          const percent = total === 0 ? 0 : Math.round((option.votes / total) * 100);
          return (
            <li key={option.id} style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  data-testid={`vote-${option.id}`}
                  onClick={() => handleVote(option.id)}
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Vote: {option.text}
                </button>
                <span data-testid={`count-${option.id}`}>{option.votes} votes</span>
                <span data-testid={`percent-${option.id}`}>{percent}%</span>
              </div>
              <div
                style={{
                  background: "#eee",
                  height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    background: "#4caf50",
                    height: "100%",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
