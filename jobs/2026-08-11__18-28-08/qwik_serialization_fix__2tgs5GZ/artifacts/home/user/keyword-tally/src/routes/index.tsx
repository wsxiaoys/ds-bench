import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { ActivityRecorder } from '../lib/activity-recorder';

const KEYWORDS = ['alpha', 'beta', 'gamma', 'delta'];

export default component$(() => {
  // These values are captured by the click handler below and therefore must
  // cross Qwik's `$` serialization boundary. As written, none of them can.
  const tally = new Map<string, number>();
  const touched = new Set<string>();
  let recorder: ActivityRecorder | undefined;

  // The recorder is browser-only; it is created once the page is active.
  useVisibleTask$(() => {
    recorder = new ActivityRecorder();
  });

  // A plain helper referenced from the click handler.
  const bump = (keyword: string) => {
    tally.set(keyword, (tally.get(keyword) ?? 0) + 1);
    touched.add(keyword);
    recorder?.record(`${keyword}=${tally.get(keyword)}`);
  };

  const total = [...tally.values()].reduce((sum, n) => sum + n, 0);

  return (
    <main>
      <h1>Keyword Tally</h1>
      <p data-testid="recorder-status">{recorder ? 'recording' : 'idle'}</p>
      <p data-testid="log-count">Events: {recorder ? recorder.count : 0}</p>
      <p data-testid="total">Total: {total}</p>
      <p data-testid="touched">Touched: {touched.size}</p>
      <ul>
        {KEYWORDS.map((keyword) => (
          <li key={keyword}>
            <button data-testid={`btn-${keyword}`} onClick$={() => bump(keyword)}>
              {keyword}: {tally.get(keyword) ?? 0}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
});
