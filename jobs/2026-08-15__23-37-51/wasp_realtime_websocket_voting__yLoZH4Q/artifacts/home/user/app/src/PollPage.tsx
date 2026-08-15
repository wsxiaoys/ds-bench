import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { useAuth } from "wasp/client/auth";

export function PollPage() {
  const { slug } = useParams<{ slug: string }>();
  const { socket, isConnected } = useSocket();
  const { data: user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [pollState, setPollState] = useState<any>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Subscribe to poll
  useEffect(() => {
    if (isConnected && slug) {
      socket.emit("poll:subscribe", { slug });
      setError("");
    }
    return () => {
      if (slug) {
        socket.emit("poll:unsubscribe", { slug });
      }
    };
  }, [slug, isConnected, socket]);

  // Listen to state updates
  useSocketListener("poll:state", (state: any) => {
    if (state && state.slug === slug) {
      setPollState(state);
      setMissing(false);
    }
  });

  // Listen to errors
  useSocketListener("poll:error", (err: any) => {
    if (err.code === "POLL_NOT_FOUND") {
      setMissing(true);
    } else {
      setError(`${err.code}: ${err.message}`);
    }
  });

  if (authLoading) {
    return <div style={{ padding: "2rem" }}>Loading authentication...</div>;
  }

  if (missing) {
    return (
      <div style={{ padding: "2rem" }} data-testid="poll-missing">
        <h2>Poll Not Found</h2>
        <p>The poll with slug "{slug}" does not exist.</p>
      </div>
    );
  }

  if (!pollState) {
    return <div style={{ padding: "2rem" }}>Loading poll data...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1 data-testid="poll-question">{pollState.question}</h1>
      
      <div style={{ margin: "1rem 0", padding: "1rem", background: "#f9f9f9", borderRadius: "5px" }}>
        <p>Status: <strong data-testid="poll-status">{pollState.isClosed ? "closed" : "open"}</strong></p>
        <p>Revision: <span data-testid="poll-revision">{pollState.revision}</span></p>
        <p>Total Votes: <span data-testid="poll-total-votes">{pollState.totalVotes}</span></p>
        <p>Leader Option ID: <span data-testid="poll-leader">{pollState.leaderOptionId !== null ? pollState.leaderOptionId : "none"}</span></p>
        <p>My Vote Option ID: <span data-testid="poll-my-vote">{pollState.myVoteOptionId !== null ? pollState.myVoteOptionId : "none"}</span></p>
      </div>

      {error && (
        <div style={{ color: "red", padding: "0.5rem", background: "#fee", marginBottom: "1rem", borderRadius: "3px" }}>
          {error}
        </div>
      )}

      <h2>Options</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {pollState.options.map((opt: any) => {
          const votersJoined = opt.voters.join(",");
          return (
            <div key={opt.id} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "5px" }}>
              <h3 data-testid={`option-label-${opt.id}`}>{opt.label}</h3>
              <p>Votes: <span data-testid={`option-votes-${opt.id}`}>{opt.votes}</span></p>
              <p>Voters: <span data-testid={`option-voters-${opt.id}`}>{votersJoined}</span></p>
              <button
                data-testid={`option-vote-${opt.id}`}
                onClick={() => {
                  setError("");
                  socket.emit("poll:vote", { slug, optionId: opt.id });
                }}
                disabled={pollState.isClosed}
                style={{ padding: "0.5rem 1rem", cursor: pollState.isClosed ? "not-allowed" : "pointer" }}
              >
                Vote
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button
          data-testid="poll-retract"
          onClick={() => {
            setError("");
            socket.emit("poll:retract", { slug });
          }}
          disabled={pollState.isClosed}
          style={{ padding: "0.5rem 1rem", cursor: pollState.isClosed ? "not-allowed" : "pointer" }}
        >
          Retract Vote
        </button>

        {!pollState.isClosed && (
          <button
            onClick={() => {
              setError("");
              socket.emit("poll:close", { slug });
            }}
            style={{ padding: "0.5rem 1rem", background: "#f44336", color: "white", border: "none", borderRadius: "3px", cursor: "pointer" }}
          >
            Close Poll
          </button>
        )}
      </div>
    </div>
  );
}
