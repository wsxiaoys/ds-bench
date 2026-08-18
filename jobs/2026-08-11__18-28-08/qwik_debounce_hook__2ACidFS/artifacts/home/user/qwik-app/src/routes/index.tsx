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
  const debounced = useDebouncedSignal(debounceInput, 500);
  const previousDebounced = usePrevious(debounced);

  const throttleInput = useSignal("");
  const throttled = useThrottledSignal(throttleInput, 500);

  const count = useSignal(0);
  const enabled = useSignal(false);

  // We wrap the callback in $() to create a serializable QRL callback.
  const increment = $(() => {
    count.value++;
  });

  useInterval(increment, 200, enabled);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Qwik Reactive Timing Hooks Demo</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>Debounce Section</h2>
        <label>
          Debounce Input:{" "}
          <input
            type="text"
            data-testid="debounce-input"
            value={debounceInput.value}
            onInput$={(ev) => {
              debounceInput.value = (ev.target as HTMLInputElement).value;
            }}
          />
        </label>
        <div>
          Debounced Value:{" "}
          <span data-testid="debounced-value">{debounced.value}</span>
        </div>
        <div>
          Previous Debounced Value:{" "}
          <span data-testid="previous-value">
            {previousDebounced.value !== undefined ? previousDebounced.value : ""}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2>Throttle Section</h2>
        <label>
          Throttle Input:{" "}
          <input
            type="text"
            data-testid="throttle-input"
            value={throttleInput.value}
            onInput$={(ev) => {
              throttleInput.value = (ev.target as HTMLInputElement).value;
            }}
          />
        </label>
        <div>
          Throttled Value:{" "}
          <span data-testid="throttled-value">{throttled.value}</span>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2>Interval Section</h2>
        <div>
          Interval Count:{" "}
          <span data-testid="interval-count">{count.value}</span>
        </div>
        <button
          data-testid="toggle-timer"
          onClick$={() => {
            enabled.value = !enabled.value;
          }}
        >
          {enabled.value ? "Disable Timer" : "Enable Timer"}
        </button>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Qwik Reactive Timing Hooks Demo",
  meta: [
    {
      name: "description",
      content: "Demo page for testing reusable timing hooks in Qwik",
    },
  ],
};
