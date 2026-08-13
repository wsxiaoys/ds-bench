import { component$, useSignal, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  useDebouncedSignal,
  useThrottledSignal,
  usePrevious,
  useInterval,
} from "../hooks/signals";

export default component$(() => {
  const debounceInput = useSignal("");
  const throttleInput = useSignal("");
  const intervalCount = useSignal(0);
  const intervalEnabled = useSignal(false);

  const debounced = useDebouncedSignal(debounceInput, 500);
  const previousDebounced = usePrevious(debounced);
  const throttled = useThrottledSignal(throttleInput, 500);

  const increment = $(() => {
    intervalCount.value += 1;
  });

  useInterval(increment, 200, intervalEnabled);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Qwik Timing Hooks Demo</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Debounce & Previous</h2>
        <div>
          <label for="debounce-input">Debounce Input: </label>
          <input
            id="debounce-input"
            data-testid="debounce-input"
            bind:value={debounceInput}
            placeholder="Type here..."
          />
        </div>
        <p>
          Debounced:{" "}
          <strong data-testid="debounced-value">{debounced.value}</strong>
        </p>
        <p>
          Previous Debounced:{" "}
          <strong data-testid="previous-value">
            {previousDebounced.value ?? ""}
          </strong>
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Throttle</h2>
        <div>
          <label for="throttle-input">Throttle Input: </label>
          <input
            id="throttle-input"
            data-testid="throttle-input"
            bind:value={throttleInput}
            placeholder="Type fast..."
          />
        </div>
        <p>
          Throttled:{" "}
          <strong data-testid="throttled-value">{throttled.value}</strong>
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Interval Timer</h2>
        <p>
          Interval Count:{" "}
          <strong data-testid="interval-count">{intervalCount.value}</strong>
        </p>
        <button
          data-testid="toggle-timer"
          onClick$={() => {
            intervalEnabled.value = !intervalEnabled.value;
          }}
        >
          {intervalEnabled.value ? "Disable Timer" : "Enable Timer"}
        </button>
      </section>
    </main>
  );
});

export const head: DocumentHead = {
  title: "Qwik Timing Hooks Demo",
  meta: [
    {
      name: "description",
      content: "Demo page for reusable reactive timing hooks in Qwik",
    },
  ],
};
