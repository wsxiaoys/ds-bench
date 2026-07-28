import {
  type QRL,
  type ReadonlySignal,
  type Signal,
  isServer,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

/**
 * Mirrors `source.value`, but only applies a change after `delayMs`
 * milliseconds have elapsed with no further change to `source`.
 *
 * The initial value is applied immediately (including during SSR), and any
 * pending timer is cancelled as soon as a newer change arrives, so a burst of
 * rapid changes collapses into a single, final update.
 */
export function useDebouncedSignal<T>(
  source: Signal<T>,
  delayMs: number,
): ReadonlySignal<T> {
  const state = useSignal<T>(source.value);
  const isFirstRun = useSignal(true);

  useTask$(({ track, cleanup }) => {
    const value = track(() => source.value);

    // The initial value is always applied synchronously, with no timer.
    if (isFirstRun.value) {
      isFirstRun.value = false;
      state.value = value;
      return;
    }

    // Timers are browser-only; never schedule one while rendering on the
    // server.
    if (isServer) {
      state.value = value;
      return;
    }

    const timer = setTimeout(() => {
      state.value = value;
    }, delayMs);

    // Every re-run of this task (i.e. every new change to `source`) first
    // disposes of the previous timer, which is exactly what "restart the
    // timer on every change" means.
    cleanup(() => clearTimeout(timer));
  });

  return state;
}

/**
 * Mirrors `source.value` using leading + trailing edge throttling: the first
 * change after an idle period is applied immediately (leading edge), further
 * changes observed within `intervalMs` of the last applied update are
 * coalesced and applied once the window elapses (trailing edge). If nothing
 * changes during a window, no trailing update happens.
 */
export function useThrottledSignal<T>(
  source: Signal<T>,
  intervalMs: number,
): ReadonlySignal<T> {
  const state = useSignal<T>(source.value);
  const isFirstRun = useSignal(true);
  // Timestamp (ms) of the last value actually applied to `state`.
  const lastAppliedAt = useSignal(0);

  useTask$(({ track, cleanup }) => {
    const value = track(() => source.value);

    if (isFirstRun.value) {
      isFirstRun.value = false;
      state.value = value;
      return;
    }

    if (isServer) {
      state.value = value;
      return;
    }

    const now = Date.now();
    const elapsed = now - lastAppliedAt.value;

    if (elapsed >= intervalMs) {
      // Leading edge: we're idle (or this is the first observed change),
      // apply immediately.
      lastAppliedAt.value = now;
      state.value = value;
      return;
    }

    // Trailing edge: still inside the throttle window. Schedule (or
    // re-schedule) an update for when the window elapses. Because
    // `remaining` is always computed relative to the same `lastAppliedAt`,
    // repeatedly replacing the pending timer with a fresh one targeting the
    // same absolute point in time is equivalent to leaving a single timer in
    // place, just always carrying the most recent value.
    const remaining = intervalMs - elapsed;
    const timer = setTimeout(() => {
      lastAppliedAt.value = Date.now();
      state.value = value;
    }, remaining);

    cleanup(() => clearTimeout(timer));
  });

  return state;
}

/**
 * Holds the value `source` had immediately before its most recent change.
 * Before the first change it is `undefined`.
 */
export function usePrevious<T>(source: Signal<T>): ReadonlySignal<T | undefined> {
  const previous = useSignal<T | undefined>(undefined);
  // Tracks the last value we observed from `source`, so we can tell whether a
  // given task run represents a real change or just the initial subscription.
  const lastSeen = useSignal<T | undefined>(source.value);

  useTask$(({ track }) => {
    const value = track(() => source.value);

    if (value !== lastSeen.value) {
      previous.value = lastSeen.value;
      lastSeen.value = value;
    }
  });

  return previous;
}

/**
 * Invokes `callback` every `ms` milliseconds while `enabled.value` is `true`.
 * The timer is torn down (and never restarted) as soon as `enabled` becomes
 * `false`, and it is always cleaned up when the task reruns or the component
 * is destroyed. Never starts a timer during SSR.
 */
export function useInterval(
  callback: QRL<() => void>,
  ms: number,
  enabled: Signal<boolean>,
): void {
  // `useVisibleTask$` never executes during SSR, so `setInterval` is
  // guaranteed to only ever run in the browser.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track, cleanup }) => {
      const isEnabled = track(() => enabled.value);

      if (!isEnabled) {
        return;
      }

      const timer = setInterval(() => {
        callback();
      }, ms);

      cleanup(() => clearInterval(timer));
    },
    { strategy: "document-ready" },
  );
}
