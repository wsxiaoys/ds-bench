import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { useAuth, logout } from "wasp/client/auth";

export function PollPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { data: user } = useAuth();

  const [pollState, setPollState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  // Reset page state when slug changes
  useEffect(() => {
    setIsMissing(false);
    setError(null);
    setPollState(null);
  }, [slug]);

  // Subscribe and unsubscribe on mount/unmount
  useEffect(() => {
    if (slug && socket) {
      socket.emit("poll:subscribe", { slug });
      return () => {
        socket.emit("poll:unsubscribe", { slug });
      };
    }
  }, [slug, socket]);

  // Listen to poll:state
  useSocketListener("poll:state", (state: any) => {
    if (state.slug === slug) {
      setPollState(state);
      setError(null);
      setIsMissing(false);
    }
  });

  // Listen to poll:error
  useSocketListener("poll:error", (err: any) => {
    if (err.code === "POLL_NOT_FOUND") {
      setIsMissing(true);
    } else {
      setError(err.message);
    }
  });

  const handleVote = (optionId: number) => {
    setError(null);
    socket.emit("poll:vote", { slug, optionId });
  };

  const handleRetract = () => {
    setError(null);
    socket.emit("poll:retract", { slug });
  };

  const handleClose = () => {
    setError(null);
    socket.emit("poll:close", { slug });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (isMissing) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2 data-testid="poll-missing">Poll Not Found</h2>
        <p>The requested poll does not exist.</p>
        <button onClick={handleLogout} style={{ marginTop: "20px" }}>Logout</button>
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

  const leaderOptionIdText = pollState.leaderOptionId !== null ? String(pollState.leaderOptionId) : "none";
  const myVoteOptionIdText = pollState.myVoteOptionId !== null ? String(pollState.myVoteOptionId) : "none";
  const statusText = pollState.isClosed ? "closed" : "open";

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span>Logged in as: <strong>{user?.identities?.username?.id}</strong></span>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <h1 data-testid="poll-question">{pollState.question}</h1>

      <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px", backgroundColor: "#f9f9f9" }}>
        <p>Status: <strong data-testid="poll-status">{statusText}</strong></p>
        <p>Revision: <span data-testid="poll-revision">{pollState.revision}</span></p>
        <p>Total Votes: <span data-testid="poll-total-votes">{pollState.totalVotes}</span></p>
        <p>Leader Option ID: <span data-testid="poll-leader">{leaderOptionIdText}</span></p>
        <p>My Vote Option ID: <span data-testid="poll-my-vote">{myVoteOptionIdText}</span></p>
      </div>

      {error && <div style={{ color: "red", marginBottom: "15px", padding: "10px", border: "1px solid red", borderRadius: "4px" }}>{error}</div>}

      <div style={{ marginBottom: "20px" }}>
        <h3>Options</h3>
        {pollState.options.map((option: any) => {
          const votersText = option.voters && option.voters.length > 0 ? option.voters.join(",") : "";
          return (
            <div key={option.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div data-testid={`option-label-${option.id}`} style={{ fontWeight: "bold" }}>{option.label}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  Votes: <span data-testid={`option-votes-${option.id}`}>{option.votes}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#888" }}>
                  Voters: <span data-testid={`option-voters-${option.id}`}>{votersText}</span>
                </div>
              </div>
              <button
                data-testid={`option-vote-${option.id}`}
                onClick={() => handleVote(option.id)}
                disabled={pollState.isClosed}
                style={{ padding: "6px 12px", cursor: pollState.isClosed ? "not-allowed" : "pointer" }}
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
          style={{ padding: "10px 20px", cursor: pollState.isClosed ? "not-allowed" : "pointer", flex: 1 }}
        >
          Retract Vote
        </button>

        {!pollState.isClosed && (
          <button
            onClick={handleClose}
            style={{ padding: "10px 20px", cursor: "pointer", flex: 1, backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #c62828" }}
          >
            Close Poll
          </button>
        )}
      </div>
    </div>
  );
}
