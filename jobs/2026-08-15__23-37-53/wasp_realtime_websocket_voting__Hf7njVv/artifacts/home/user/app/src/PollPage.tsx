import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { useAuth } from "wasp/client/auth";

export function PollPage() {
  const { slug } = useParams<{ slug: string }>();
  const { socket, isConnected } = useSocket();
  const { data: user } = useAuth();

  const [pollState, setPollState] = useState<any>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  // Reset page state on slug change
  useEffect(() => {
    setIsMissing(false);
    setPollState(null);
    setPollError(null);
  }, [slug]);

  // Handle subscribe / unsubscribe
  useEffect(() => {
    if (isConnected && socket && slug) {
      socket.emit("poll:subscribe", { slug });
      return () => {
        socket.emit("poll:unsubscribe", { slug });
      };
    }
  }, [slug, isConnected, socket]);

  // Listen for poll state updates
  useSocketListener("poll:state", (state: any) => {
    if (state.slug === slug) {
      setPollState(state);
      setPollError(null);
      setIsMissing(false);
    }
  });

  // Listen for poll errors
  useSocketListener("poll:error", (err: any) => {
    if (err.code === "POLL_NOT_FOUND") {
      setIsMissing(true);
    } else {
      setPollError(err.message);
    }
  });

  if (isMissing) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2 data-testid="poll-missing">Poll Not Found</h2>
        <p>The poll with slug "{slug}" does not exist.</p>
        <Link to="/">Go Home</Link>
      </div>
    );
  }

  if (!pollState) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading poll details...</p>
      </div>
    );
  }

  const handleVote = (optionId: number) => {
    if (socket && slug) {
      socket.emit("poll:vote", { slug, optionId });
    }
  };

  const handleRetract = () => {
    if (socket && slug) {
      socket.emit("poll:retract", { slug });
    }
  };

  const handleClose = () => {
    if (socket && slug) {
      socket.emit("poll:close", { slug });
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link to="/">← Back Home</Link>
      </div>

      <h1 data-testid="poll-question" style={{ marginBottom: "10px" }}>
        {pollState.question}
      </h1>

      <div style={{ display: "flex", gap: "15px", marginBottom: "20px", fontSize: "14px", color: "#666" }}>
        <div>
          Status: <strong data-testid="poll-status">{pollState.isClosed ? "closed" : "open"}</strong>
        </div>
        <div>
          Revision: <strong data-testid="poll-revision">{pollState.revision}</strong>
        </div>
        <div>
          Total Votes: <strong data-testid="poll-total-votes">{pollState.totalVotes}</strong>
        </div>
      </div>

      <div style={{ marginBottom: "20px", padding: "10px", background: "#f8f9fa", borderRadius: "4px" }}>
        <div>
          Leader Option ID: <strong data-testid="poll-leader">{pollState.leaderOptionId ?? "none"}</strong>
        </div>
        <div>
          My Vote Option ID: <strong data-testid="poll-my-vote">{pollState.myVoteOptionId ?? "none"}</strong>
        </div>
      </div>

      {pollError && (
        <div style={{ color: "red", padding: "10px", border: "1px solid red", borderRadius: "4px", marginBottom: "20px" }}>
          Error: {pollError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
        {pollState.options.map((opt: any) => {
          const isMyVote = pollState.myVoteOptionId === opt.id;
          return (
            <div
              key={opt.id}
              style={{
                padding: "15px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isMyVote ? "#e9ecef" : "#fff",
              }}
            >
              <div>
                <div data-testid={`option-label-${opt.id}`} style={{ fontWeight: "bold", fontSize: "16px" }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
                  Votes: <span data-testid={`option-votes-${opt.id}`}>{opt.votes}</span>
                </div>
                {opt.voters.length > 0 && (
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>
                    Voters: <span data-testid={`option-voters-${opt.id}`}>{opt.voters.join(",")}</span>
                  </div>
                )}
                {opt.voters.length === 0 && (
                  <span data-testid={`option-voters-${opt.id}`} style={{ display: "none" }}></span>
                )}
              </div>
              <button
                data-testid={`option-vote-${opt.id}`}
                onClick={() => handleVote(opt.id)}
                disabled={pollState.isClosed}
                style={{
                  padding: "8px 12px",
                  background: isMyVote ? "#28a745" : "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: pollState.isClosed ? "not-allowed" : "pointer",
                  opacity: pollState.isClosed ? 0.6 : 1,
                }}
              >
                {isMyVote ? "Voted" : "Vote"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          data-testid="poll-retract"
          onClick={handleRetract}
          disabled={pollState.isClosed || !pollState.myVoteOptionId}
          style={{
            padding: "10px 15px",
            background: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: (pollState.isClosed || !pollState.myVoteOptionId) ? "not-allowed" : "pointer",
            opacity: (pollState.isClosed || !pollState.myVoteOptionId) ? 0.6 : 1,
          }}
        >
          Retract Vote
        </button>

        {!pollState.isClosed && (
          <button
            onClick={handleClose}
            style={{
              padding: "10px 15px",
              background: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close Poll
          </button>
        )}
      </div>
    </div>
  );
}
