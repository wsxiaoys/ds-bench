import { component$, useStore, $ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { getPoll, getOptions } from '../../../db';

export const usePollData = routeLoader$(async (event) => {
  const pollId = event.params.id;
  const poll = getPoll(pollId);
  if (!poll) {
    throw event.text(404, 'Poll not found');
  }
  const options = getOptions(pollId);
  return {
    poll,
    options,
  };
});

export default component$(() => {
  const pollData = usePollData();

  const state = useStore({
    options: pollData.value.options.map(o => ({ ...o })),
    errorMessage: '',
  });

  const totalVotes = state.options.reduce((sum, opt) => sum + opt.votes, 0);

  const castVote = $(async (optionId: number) => {
    state.errorMessage = '';
    try {
      const response = await fetch(`/poll/${pollData.value.poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        state.options = state.options.map(opt => {
          const updatedVotes = data.votes[String(opt.id)];
          if (updatedVotes !== undefined) {
            return { ...opt, votes: updatedVotes };
          }
          return opt;
        });
      } else {
        state.errorMessage = data.error || 'An error occurred';
      }
    } catch {
      state.errorMessage = 'Network error occurred';
    }
  });

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '600px',
      margin: '40px auto',
      padding: '24px',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      backgroundColor: '#ffffff'
    }}>
      <h1 id="poll-question" style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: '#1e293b'
      }}>
        {pollData.value.poll.question}
      </h1>

      <div style={{ marginBottom: '24px' }}>
        <svg id="poll-chart" width="500" height="300" style={{
          border: '1px solid #f1f5f9',
          borderRadius: '8px',
          backgroundColor: '#f8fafc',
          padding: '10px'
        }}>
          {state.options.map((opt, i) => {
            const barHeight = 30;
            const barSpacing = 25;
            const startY = 40;
            const y = startY + i * (barHeight + barSpacing);
            const barWidth = totalVotes === 0 ? 0 : (opt.votes / totalVotes) * 400;

            return (
              <g key={opt.id}>
                {/* Option label */}
                <text
                  x="10"
                  y={y - 6}
                  fill="#475569"
                  style={{ fontSize: '13px', fontWeight: '600' }}
                >
                  {opt.text}
                </text>

                {/* Bar background */}
                <rect
                  x="10"
                  y={y}
                  width="400"
                  height={barHeight}
                  rx="4"
                  ry="4"
                  fill="#e2e8f0"
                />

                {/* Bar */}
                <rect
                  class="chart-bar"
                  data-option-id={opt.id}
                  x="10"
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  ry="4"
                  fill="#3b82f6"
                  style={{ transition: 'width 0.3s ease' }}
                />

                {/* Vote count */}
                <text
                  class="vote-count"
                  data-option-id={opt.id}
                  x={barWidth + 20}
                  y={y + 20}
                  fill="#1e293b"
                  style={{ fontSize: '14px', fontWeight: '700' }}
                >
                  {opt.votes}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {state.errorMessage && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          color: '#b91c1c',
          marginBottom: '20px',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {state.errorMessage}
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {state.options.map((opt) => (
          <button
            key={opt.id}
            class="vote-button"
            data-option-id={opt.id}
            onClick$={() => castVote(opt.id)}
            style={{
              padding: '12px 16px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#ffffff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              textAlign: 'left'
            }}
          >
            Vote for {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
});
