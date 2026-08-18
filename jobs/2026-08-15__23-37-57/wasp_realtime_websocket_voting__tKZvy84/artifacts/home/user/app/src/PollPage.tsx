import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import type { AuthUser } from "wasp/auth";

export function PollPage({ user }: { user: AuthUser }) {
  const { slug } = useParams<{ slug: string }>();
  const { socket } = useSocket();
  const [pollState, setPollState] = useState<any>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!slug) return;

    // Reset state when slug changes
    setPollState(null);
    setIsMissing(false);
    setErrorMsg("");

    // Subscribe to the poll
    socket.emit("poll:subscribe", { slug });

    return () => {
      socket.emit("poll:unsubscribe", { slug });
    };
  }, [slug, socket]);

  useSocketListener("poll:state", (state: any) => {
    if (state.slug === slug) {
      setPollState(state);
      setIsMissing(false);
    }
  });

  useSocketListener("poll:error", (err: any) => {
    if (err.code === "POLL_NOT_FOUND") {
      setIsMissing(true);
    } else {
      setErrorMsg(err.message || "An error occurred");
    }
  });

  if (isMissing) {
    return <div data-testid="poll-missing">Poll not found</div>;
  }

  if (!pollState) {
    return <div>Loading poll...</div>;
  }

  const handleVote = (optionId: number) => {
    setErrorMsg("");
    socket.emit("poll:vote", { slug, optionId });
  };

  const handleRetract = () => {
    setErrorMsg("");
    socket.emit("poll:retract", { slug });
  };

  const handleClose = () => {
    setErrorMsg("");
    socket.emit("poll:close", { slug });
  };

  const statusText = pollState.isClosed ? "closed" : "open";
  const leaderText = pollState.leaderOptionId !== null ? String(pollState.leaderOptionId) : "none";
  const myVoteText = pollState.myVoteOptionId !== null ? String(pollState.myVoteOptionId) : "none";

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h1 data-testid="poll-question">{pollState.question}</h1>
      
      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      <div style={{ marginBottom: "20px" }}>
        <p>Status: <span data-testid="poll-status">{statusText}</span></p>
        <p>Revision: <span data-testid="poll-revision">{pollState.revision}</span></p>
        <p>Total Votes: <span data-testid="poll-total-votes">{pollState.totalVotes}</span></p>
        <p>Leader: <span data-testid="poll-leader">{leaderText}</span></p>
        <p>My Vote: <span data-testid="poll-my-vote">{myVoteText}</span></p>
      </div>

      <h2>Options</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
        {pollState.options.map((opt: any) => {
          const votersText = opt.voters.join(",");
          return (
            <div key={opt.id} style={{ padding: "10px", border: "1px solid #eee", borderRadius: "5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span data-testid={`option-label-${opt.id}`} style={{ fontWeight: "bold" }}>{opt.label}</span>
                <span data-testid={`option-votes-${opt.id}`}>{opt.votes}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                Voters: <span data-testid={`option-voters-${opt.id}`}>{votersText}</span>
              </div>
              <button
                data-testid={`option-vote-${opt.id}`}
                onClick={() => handleVote(opt.id)}
                disabled={pollState.isClosed}
                style={{ marginTop: "10px", padding: "5px 10px", cursor: "pointer" }}
              >
                Vote
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          data-testid="poll-retract"
          onClick={handleRetract}
          disabled={pollState.isClosed}
          style={{ padding: "10px 15px", cursor: "pointer", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px" }}
        >
          Retract Vote
        </button>

        {!pollState.isClosed && (
          <button
            onClick={handleClose}
            style={{ padding: "10px 15px", cursor: "pointer", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
          >
            Close Poll
          </button>
        )}
      </div>
    </div>
  );
}
