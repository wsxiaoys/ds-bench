import { $, component$, useSignal } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  useDebouncedSignal,
  useInterval,
  usePrevious,
  useThrottledSignal,
} from "~/hooks/signals";

export default component$(() => {
  const debounceSource = useSignal("");
  const debounced = useDebouncedSignal(debounceSource, 500);
  const previous = usePrevious(debounced);

  const throttleSource = useSignal("");
  const throttled = useThrottledSignal(throttleSource, 500);

  const count = useSignal(0);
  const enabled = useSignal(false);

  useInterval(
    $(() => {
      count.value++;
    }),
    200,
    enabled,
  );

  return (
    <>
      <h1>Reactive Timing Hooks Demo</h1>

      <section>
        <h2>useDebouncedSignal</h2>
        <input
          data-testid="debounce-input"
          value={debounceSource.value}
          onInput$={(_, el) => (debounceSource.value = el.value)}
        />
        <div>
          Debounced value: <span data-testid="debounced-value">{debounced.value}</span>
        </div>
        <div>
          Previous debounced value:{" "}
          <span data-testid="previous-value">{previous.value ?? ""}</span>
        </div>
      </section>

      <section>
        <h2>useThrottledSignal</h2>
        <input
          data-testid="throttle-input"
          value={throttleSource.value}
          onInput$={(_, el) => (throttleSource.value = el.value)}
        />
        <div>
          Throttled value: <span data-testid="throttled-value">{throttled.value}</span>
        </div>
      </section>

      <section>
        <h2>useInterval</h2>
        <div>
          Interval count: <span data-testid="interval-count">{count.value}</span>
        </div>
        <button
          type="button"
          data-testid="toggle-timer"
          onClick$={() => (enabled.value = !enabled.value)}
        >
          {enabled.value ? "Stop" : "Start"} Timer
        </button>
      </section>
    </>
  );
});

export const head: DocumentHead = {
  title: "Reactive Timing Hooks Demo",
  meta: [
    {
      name: "description",
      content: "Demo of reusable Qwik timing hooks",
    },
  ],
};
