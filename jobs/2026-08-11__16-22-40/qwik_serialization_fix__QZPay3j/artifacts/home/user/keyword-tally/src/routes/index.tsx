import { component$, useVisibleTask$, useStore, useSignal, noSerialize, type NoSerialize } from '@builder.io/qwik';
import { ActivityRecorder } from '../lib/activity-recorder';

const KEYWORDS = ['alpha', 'beta', 'gamma', 'delta'];

export default component$(() => {
  const tallies = useStore<Record<string, number>>({
    alpha: 0,
    beta: 0,
    gamma: 0,
    delta: 0,
  });

  const eventCount = useSignal(0);
  const recorderStatus = useSignal('idle');

  const state = useStore<{
    recorder: NoSerialize<ActivityRecorder> | undefined;
  }>({
    recorder: undefined,
  });

  useVisibleTask$(() => {
    state.recorder = noSerialize(new ActivityRecorder());
    recorderStatus.value = 'recording';
  });

  return (
    <main>
      <h1>Keyword Tally</h1>
      <p data-testid="recorder-status">{recorderStatus.value}</p>
      <p data-testid="log-count">Events: {eventCount.value}</p>
      <p data-testid="total">Total: {KEYWORDS.reduce((sum, k) => sum + tallies[k], 0)}</p>
      <p data-testid="touched">Touched: {KEYWORDS.filter(k => tallies[k] > 0).length}</p>
      <ul>
        {KEYWORDS.map((keyword) => (
          <li key={keyword}>
            <button
              data-testid={`btn-${keyword}`}
              onClick$={() => {
                tallies[keyword]++;
                if (state.recorder) {
                  state.recorder.record(`${keyword}=${tallies[keyword]}`);
                  eventCount.value = state.recorder.count;
                }
              }}
            >
              {keyword}: {tallies[keyword]}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
});
