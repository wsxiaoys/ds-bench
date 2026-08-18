import {
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  isServer,
  type Signal,
  type ReadonlySignal,
  type QRL,
} from "@builder.io/qwik";

/**
 * Returns a read-only signal that mirrors `source.value`, but updates are debounced by `delayMs`.
 */
export function useDebouncedSignal<T>(
  source: Signal<T>,
  delayMs: number
): ReadonlySignal<T> {
  const debounced = useSignal<T>(source.value);

  useTask$(({ track, cleanup }) => {
    const value = track(() => source.value);

    if (isServer) {
      debounced.value = value;
      return;
    }

    if (debounced.value === value) {
      return;
    }

    const id = setTimeout(() => {
      debounced.value = value;
    }, delayMs);

    cleanup(() => clearTimeout(id));
  });

  return debounced;
}

/**
 * Returns a read-only signal implementing leading + trailing edge throttling.
 */
export function useThrottledSignal<T>(
  source: Signal<T>,
  intervalMs: number
): ReadonlySignal<T> {
  const throttled = useSignal<T>(source.value);

  const state = useStore({
    lastApplied: 0,
    hasTrailing: false,
    trailingValue: undefined as T | undefined,
  });

  useTask$(({ track, cleanup }) => {
    const value = track(() => source.value);

    if (isServer) {
      throttled.value = value;
      return;
    }

    const now = Date.now();
    const elapsed = now - state.lastApplied;

    if (elapsed >= intervalMs) {
      // Leading edge: update immediately
      throttled.value = value;
      state.lastApplied = now;
      state.hasTrailing = false;
      state.trailingValue = undefined;
    } else {
      // Within window: save as trailing value and schedule timer for the remaining time
      state.trailingValue = value;
      state.hasTrailing = true;

      const remaining = intervalMs - elapsed;
      const id = setTimeout(() => {
        if (state.hasTrailing) {
          throttled.value = state.trailingValue as T;
          state.lastApplied = Date.now();
          state.hasTrailing = false;
          state.trailingValue = undefined;
        }
      }, remaining);

      cleanup(() => clearTimeout(id));
    }
  });

  return throttled;
}

/**
 * Returns a read-only signal holding the value `source` had immediately before its most recent change.
 */
export function usePrevious<T>(
  source: Signal<T>
): ReadonlySignal<T | undefined> {
  const previous = useSignal<T | undefined>(undefined);
  const current = useSignal<T>(source.value);

  useTask$(({ track }) => {
    const value = track(() => source.value);

    if (value !== current.value) {
      previous.value = current.value;
      current.value = value;
    }
  });

  return previous;
}

/**
 * Invokes a serializable QRL callback every `ms` milliseconds while `enabled.value` is true.
 */
export function useInterval(
  callback: QRL<() => void>,
  ms: number,
  enabled: Signal<boolean>
): void {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const isEnabled = track(() => enabled.value);

    if (!isEnabled) {
      return;
    }

    const id = setInterval(() => {
      callback();
    }, ms);

    cleanup(() => clearInterval(id));
  });
}
