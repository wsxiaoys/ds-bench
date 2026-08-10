import { component$, useSignal, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useDebouncedSignal, useThrottledSignal, usePrevious, useInterval } from "../hooks/signals";

export default component$(() => {
  const debounceSource = useSignal("");
  const debounced = useDebouncedSignal(debounceSource, 500);
  const previousDebounced = usePrevious(debounced);

  const throttleSource = useSignal("");
  const throttled = useThrottledSignal(throttleSource, 500);

  const intervalCount = useSignal(0);
  const enabled = useSignal(false);

  const increment = $(() => {
    intervalCount.value++;
  });

  useInterval(increment, 200, enabled);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Qwik Reactive Timing Hooks Demo</h1>

      <section style={{ marginBottom: "20px" }}>
        <h2>Debounce & Previous</h2>
        <input
          data-testid="debounce-input"
          value={debounceSource.value}
          onInput$={(ev, el) => {
            debounceSource.value = el.value;
          }}
          placeholder="Type here to debounce..."
        />
        <p>
          Debounced Value: <span data-testid="debounced-value">{debounced.value}</span>
        </p>
        <p>
          Previous Debounced Value: <span data-testid="previous-value">{previousDebounced.value ?? ""}</span>
        </p>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>Throttle</h2>
        <input
          data-testid="throttle-input"
          value={throttleSource.value}
          onInput$={(ev, el) => {
            throttleSource.value = el.value;
          }}
          placeholder="Type here to throttle..."
        />
        <p>
          Throttled Value: <span data-testid="throttled-value">{throttled.value}</span>
        </p>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>Interval Timer</h2>
        <p>
          Interval Count: <span data-testid="interval-count">{intervalCount.value}</span>
        </p>
        <button
          data-testid="toggle-timer"
          onClick$={() => {
            enabled.value = !enabled.value;
          }}
        >
          {enabled.value ? "Disable Timer" : "Enable Timer"}
        </button>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Qwik Reactive Timing Hooks Demo",
  meta: [
    {
      name: "description",
      content: "Demo of debouncing, throttling, previous value, and interval hooks in Qwik.",
    },
  ],
};
