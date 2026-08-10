import {
  component$,
  useStore,
  useSignal,
  useVisibleTask$,
  noSerialize,
  type NoSerialize,
} from '@builder.io/qwik';
import { ActivityRecorder } from '../lib/activity-recorder';

const KEYWORDS = ['alpha', 'beta', 'gamma', 'delta'] as const;

export default component$(() => {
  // Plain, serializable reactive state - safe to cross the `$` boundary.
  const tally = useStore<Record<string, number>>(
    Object.fromEntries(KEYWORDS.map((keyword) => [keyword, 0])),
  );
  const recorderStatus = useSignal<'idle' | 'recording'>('idle');
  const eventCount = useSignal(0);

  // The recorder instance itself is browser-only and NOT serializable, so it
  // is wrapped with `noSerialize()` and only ever created inside a
  // `useVisibleTask$`, which never runs during server rendering.
  const recorderRef = useSignal<NoSerialize<ActivityRecorder>>();

  useVisibleTask$(() => {
    recorderRef.value = noSerialize(new ActivityRecorder());
    recorderStatus.value = 'recording';
  });

  const total = KEYWORDS.reduce((sum, keyword) => sum + tally[keyword], 0);
  const touched = KEYWORDS.filter((keyword) => tally[keyword] >= 1).length;

  return (
    <main>
      <h1>Keyword Tally</h1>
      <p data-testid="recorder-status">{recorderStatus.value}</p>
      <p data-testid="log-count">Events: {eventCount.value}</p>
      <p data-testid="total">Total: {total}</p>
      <p data-testid="touched">Touched: {touched}</p>
      <ul>
        {KEYWORDS.map((keyword) => (
          <li key={keyword}>
            <button
              data-testid={`btn-${keyword}`}
              onClick$={() => {
                tally[keyword] = (tally[keyword] ?? 0) + 1;
                const recorder = recorderRef.value;
                if (recorder) {
                  eventCount.value = recorder.record(`${keyword}=${tally[keyword]}`);
                }
              }}
            >
              {keyword}: {tally[keyword]}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
});
