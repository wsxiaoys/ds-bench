import { useSignal, useStore, useTask$, useComputed$, isServer } from "@builder.io/qwik";
import type { Signal, QRL } from "@builder.io/qwik";

/**
 * Hook 1: useDebouncedSignal
 * Returns a read-only signal that mirrors the source signal, but only after delayMs have elapsed.
 */
export function useDebouncedSignal<T>(source: Signal<T>, delayMs: number): Signal<T> {
  const debounced = useSignal<T>(source.value);

  useTask$(({ track, cleanup }) => {
    const val = track(() => source.value);

    if (isServer) {
      debounced.value = val;
      return;
    }

    if (debounced.value === val) {
      return;
    }

    const timer = setTimeout(() => {
      debounced.value = val;
    }, delayMs);

    cleanup(() => clearTimeout(timer));
  });

  return useComputed$(() => debounced.value);
}

/**
 * Hook 2: useThrottledSignal
 * Returns a read-only signal implementing leading + trailing edge throttling.
 */
export function useThrottledSignal<T>(source: Signal<T>, intervalMs: number): Signal<T> {
  const throttled = useSignal<T>(source.value);

  // Store for non-tracked mutable state
  const state = useStore({
    lastAppliedTime: 0,
    hasPending: false,
    pendingValue: source.value,
  });

  useTask$(({ track, cleanup }) => {
    const val = track(() => source.value);

    if (isServer) {
      throttled.value = val;
      return;
    }

    const now = Date.now();
    const elapsed = now - state.lastAppliedTime;

    if (elapsed >= intervalMs) {
      // Leading edge: apply immediately
      throttled.value = val;
      state.lastAppliedTime = now;
      state.hasPending = false;
    } else {
      // Within the throttling window: save as pending and schedule timer
      state.pendingValue = val;
      state.hasPending = true;

      const remaining = intervalMs - elapsed;
      const timer = setTimeout(() => {
        if (state.hasPending) {
          throttled.value = state.pendingValue;
          state.lastAppliedTime = Date.now();
          state.hasPending = false;
        }
      }, remaining);

      cleanup(() => clearTimeout(timer));
    }
  });

  return useComputed$(() => throttled.value);
}

/**
 * Hook 3: usePrevious
 * Returns a read-only signal holding the value source had immediately before its most recent change.
 */
export function usePrevious<T>(source: Signal<T>): Signal<T | undefined> {
  const previous = useSignal<T | undefined>(undefined);
  const current = useSignal<T>(source.value);

  useTask$(({ track }) => {
    const val = track(() => source.value);

    if (val !== current.value) {
      previous.value = current.value;
      current.value = val;
    }
  });

  return useComputed$(() => previous.value);
}

/**
 * Hook 4: useInterval
 * Invokes callback every ms milliseconds while enabled is true.
 */
export function useInterval(callback: QRL<() => void>, ms: number, enabled: Signal<boolean>): void {
  useTask$(({ track, cleanup }) => {
    const isEnabled = track(() => enabled.value);

    if (isServer) {
      return;
    }

    if (!isEnabled) {
      return;
    }

    const timer = setInterval(() => {
      callback();
    }, ms);

    cleanup(() => clearInterval(timer));
  });
}
