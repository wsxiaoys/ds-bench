import { component$, useStore, $ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { getPollWithOptions } from "../../../db";

export const usePollLoader = routeLoader$(async (ev) => {
  const pollId = ev.params.id;
  const pollData = getPollWithOptions(pollId);
  if (!pollData) {
    throw ev.error(404, "Poll not found");
  }
  return pollData;
});

export default component$(() => {
  const loader = usePollLoader();
  
  const state = useStore({
    options: loader.value.options,
    error: "",
  });

  const handleVote = $(async (optionId: number) => {
    state.error = "";
    try {
      const response = await fetch(`/poll/${loader.value.poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optionId }),
      });

      const data = await response.json();
      if (!response.ok) {
        state.error = data.error || "An error occurred";
        return;
      }

      if (data.success && data.votes) {
        state.options = state.options.map((opt) => ({
          ...opt,
          votes: data.votes[String(opt.id)] ?? opt.votes,
        }));
      }
    } catch (err) {
      state.error = "Failed to submit vote";
    }
  });

  const totalVotes = state.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div class="poll-container" style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1 id="poll-question">{loader.value.poll.question}</h1>
      
      {state.error && (
        <div class="error-message" style={{ color: "red", marginBottom: "15px", fontWeight: "bold" }}>
          {state.error}
        </div>
      )}

      <svg id="poll-chart" width="500" height="300" style={{ border: "1px solid #ccc", background: "#f9f9f9" }}>
        {state.options.map((opt, index) => {
          const percentage = totalVotes > 0 ? (opt.votes / totalVotes) : 0;
          const barWidth = percentage * 400;
          const y = 30 + index * 50;

          return (
            <g key={opt.id}>
              <text x="10" y={y + 18} font-size="14" fill="#333">
                {opt.text}
              </text>
              <rect
                class="chart-bar"
                data-option-id={opt.id}
                x="100"
                y={y}
                width={barWidth}
                height="24"
                fill="#3182ce"
                rx="4"
              />
              <text
                class="vote-count"
                data-option-id={opt.id}
                x={110 + barWidth}
                y={y + 18}
                font-size="14"
                fill="#333"
                font-weight="bold"
              >
                {opt.votes}
              </text>
            </g>
          );
        })}
      </svg>

      <div class="vote-buttons" style={{ marginTop: "20px" }}>
        {state.options.map((opt) => (
          <button
            key={opt.id}
            class="vote-button"
            data-option-id={opt.id}
            onClick$={() => handleVote(opt.id)}
            style={{
              marginRight: "10px",
              padding: "8px 16px",
              background: "#3182ce",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Vote for {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
});
