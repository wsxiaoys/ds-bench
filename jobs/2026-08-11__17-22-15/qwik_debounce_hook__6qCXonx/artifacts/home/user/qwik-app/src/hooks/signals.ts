import { useSignal, useTask$, useVisibleTask$, isServer, type Signal, type QRL } from '@builder.io/qwik';

/**
 * 1. useDebouncedSignal
 * Returns a read-only signal that mirrors the source signal,
 * but changes are only applied after delayMs of inactivity.
 */
export function useDebouncedSignal<T>(source: Signal<T>, delayMs: number): Signal<T> {
  const debounced = useSignal<T>(source.value);

  useTask$(({ track, cleanup }) => {
    const value = track(() => source.value);

    if (isServer) {
      debounced.value = value;
      return;
    }

    const timer = setTimeout(() => {
      debounced.value = value;
    }, delayMs);

    cleanup(() => {
      clearTimeout(timer);
    });
  });

  return debounced;
}

/**
 * 2. useThrottledSignal
 * Returns a read-only signal implementing leading + trailing edge throttling.
 */
export function useThrottledSignal<T>(source: Signal<T>, intervalMs: number): Signal<T> {
  const throttled = useSignal<T>(source.value);
  const lastApplied = useSignal<number>(0);
  const pendingValue = useSignal<T | undefined>(undefined);
  const hasPending = useSignal<boolean>(false);
  const timerId = useSignal<any>(null);

  useTask$(({ track }) => {
    const value = track(() => source.value);

    if (isServer) {
      throttled.value = value;
      return;
    }

    const now = Date.now();
    const timeSinceLastApply = now - lastApplied.value;

    if (timeSinceLastApply >= intervalMs) {
      // Leading edge: update immediately
      throttled.value = value;
      lastApplied.value = now;
      hasPending.value = false;
      pendingValue.value = undefined;
      if (timerId.value) {
        clearTimeout(timerId.value);
        timerId.value = null;
      }
    } else {
      // Within throttling window: save as pending
      pendingValue.value = value;
      hasPending.value = true;

      if (!timerId.value) {
        const remaining = intervalMs - timeSinceLastApply;
        timerId.value = setTimeout(() => {
          if (hasPending.value) {
            throttled.value = pendingValue.value!;
            lastApplied.value = Date.now();
            hasPending.value = false;
            pendingValue.value = undefined;
          }
          timerId.value = null;
        }, remaining);
      }
    }
  });

  // Separate task to clean up the timer on unmount to prevent leaks
  useTask$(({ cleanup }) => {
    cleanup(() => {
      if (timerId.value) {
        clearTimeout(timerId.value);
      }
    });
  });

  return throttled;
}

/**
 * 3. usePrevious
 * Returns a read-only signal holding the value source had immediately before its most recent change.
 * Before the first change, it is undefined.
 */
export function usePrevious<T>(source: Signal<T>): Signal<T | undefined> {
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
 * 4. useInterval
 * Invokes the serializable callback every ms milliseconds while enabled is true.
 */
export function useInterval(callback: QRL<() => void>, ms: number, enabled: Signal<boolean>): void {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const isEnabled = track(() => enabled.value);

    if (isEnabled) {
      const interval = setInterval(() => {
        callback();
      }, ms);

      cleanup(() => {
        clearInterval(interval);
      });
    }
  });
}
