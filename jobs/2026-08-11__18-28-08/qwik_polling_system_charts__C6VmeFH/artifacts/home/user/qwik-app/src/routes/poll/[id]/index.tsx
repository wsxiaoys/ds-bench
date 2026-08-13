import { component$, useStore, $ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { getPoll, getOptions } from "../../../db";

export const usePollData = routeLoader$(({ params, send }) => {
  const poll = getPoll(params.id);
  if (!poll) {
    send(404, "Poll not found");
    return;
  }
  const options = getOptions(params.id);
  return { poll, options };
});

export default component$(() => {
  const pollData = usePollData();
  const state = useStore({
    options: pollData.value?.options || [],
    error: "",
    loading: false,
  });

  const totalVotes = state.options.reduce((sum, opt) => sum + opt.votes, 0);

  const handleVote = $(async (optionId: number) => {
    if (!pollData.value) return;
    state.error = "";
    state.loading = true;
    try {
      const response = await fetch(`/poll/${pollData.value.poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optionId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        state.options = state.options.map((opt) => ({
          ...opt,
          votes: result.votes[String(opt.id)] ?? opt.votes,
        }));
      } else {
        state.error = result.error || "An error occurred";
      }
    } catch {
      state.error = "Failed to cast vote";
    } finally {
      state.loading = false;
    }
  });

  if (!pollData.value) {
    return <div>Poll not found</div>;
  }

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 id="poll-question" style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>
        {pollData.value.poll.question}
      </h1>

      <div style={{ marginBottom: "30px", background: "#f9f9f9", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
        <h2 style={{ fontSize: "18px", marginTop: 0, marginBottom: "15px", color: "#555" }}>Results</h2>
        <svg id="poll-chart" width="500" height="300" style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px" }}>
          {state.options.map((opt, index) => {
            const percentage = totalVotes > 0 ? opt.votes / totalVotes : 0;
            const barWidth = percentage * 400;
            const yPosition = 30 + index * 60;

            return (
              <g key={opt.id}>
                {/* Option label */}
                <text x="10" y={yPosition + 15} fill="#333" style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {opt.text}
                </text>
                
                {/* Bar background */}
                <rect x="10" y={yPosition + 25} width="400" height="15" fill="#f0f0f0" rx="3" />
                
                {/* Bar foreground */}
                <rect
                  class="chart-bar"
                  data-option-id={opt.id}
                  x="10"
                  y={yPosition + 25}
                  width={barWidth}
                  height="15"
                  fill="#0070f3"
                  rx="3"
                  style={{ transition: "width 0.3s ease" }}
                />
                
                {/* Vote count text */}
                <text
                  class="vote-count"
                  data-option-id={opt.id}
                  x={Math.max(15 + barWidth, 420)}
                  y={yPosition + 37}
                  fill="#555"
                  style={{ fontSize: "14px", fontWeight: "600" }}
                >
                  {opt.votes}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <h2 style={{ fontSize: "18px", margin: "0 0 10px 0", color: "#555" }}>Cast Your Vote</h2>
        {state.options.map((opt) => (
          <button
            key={opt.id}
            class="vote-button"
            data-option-id={opt.id}
            onClick$={() => handleVote(opt.id)}
            disabled={state.loading}
            style={{
              padding: "12px 20px",
              fontSize: "16px",
              color: "#fff",
              backgroundColor: "#0070f3",
              border: "none",
              borderRadius: "5px",
              cursor: state.loading ? "not-allowed" : "pointer",
              opacity: state.loading ? 0.7 : 1,
              textAlign: "left",
              transition: "background-color 0.2s",
            }}
          >
            {opt.text}
          </button>
        ))}
      </div>

      {state.error && (
        <div style={{ marginTop: "20px", padding: "12px", borderRadius: "5px", backgroundColor: "#ffeae6", color: "#ff0000", border: "1px solid #ffd1cc" }}>
          {state.error}
        </div>
      )}
    </div>
  );
});
