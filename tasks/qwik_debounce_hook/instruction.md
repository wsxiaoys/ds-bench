# Reusable Reactive Timing Hooks in Qwik

## Background
Qwik is a resumable web framework whose reactivity and lifecycle hooks must run synchronously during a component's render, and whose closures cross a server/client serialization boundary. You must build a small library of **reusable custom hooks** that encapsulate time-based reactive behavior, then wire them into a demo page. Everything runs locally in the browser and on the local SSR server — there is no external network, API, database, or cloud dependency of any kind, and you must not add one.

The hooks are the hard part: they must obey Qwik's hook-context rules (a hook invoked outside a synchronous render context throws the runtime `Code(20)` error), respect serialization boundaries for any captured callbacks, be safe to run during server-side rendering (no access to `window`/`document`/browser-only globals while rendering on the server), and never leak timers.

## Requirements
Build a Qwik application that defines four custom hooks and a demo page that uses all of them together.

### The four hooks
All four hooks must be defined at module scope, exported by the exact names below, and be callable synchronously at the top of a component (i.e. they compose correctly as custom hooks). They must have exactly these public signatures and observable contracts:

1. `useDebouncedSignal<T>(source, delayMs)` returns a read-only signal.
   - The returned signal's value mirrors `source.value`, but a change is only applied after `delayMs` milliseconds have elapsed **with no further change** to `source`.
   - Any change to `source` before the pending delay elapses cancels the pending update and restarts the timer, so a rapid burst of changes is coalesced into a single update carrying the final value.
   - Its initial value equals the source's initial value and is applied immediately (including during SSR, with no delay and no timer on the server).

2. `useThrottledSignal<T>(source, intervalMs)` returns a read-only signal implementing leading + trailing edge throttling.
   - The first change after an idle period updates the value immediately (leading edge).
   - While still within `intervalMs` of the last applied update, further changes do NOT update the value immediately; the most recent `source` value observed during that window is applied once the window elapses (trailing edge).
   - If no change occurred during a window, no trailing update happens.
   - Its initial value equals the source's initial value.

3. `usePrevious<T>(source)` returns a read-only signal holding the value `source` had **immediately before its most recent change**. Before the first change it is `undefined`.

4. `useInterval(callback, ms, enabled)` returns `void`. `callback` is a serializable QRL callback (`QRL<() => void>`), `ms` is a number, and `enabled` is a `Signal<boolean>`.
   - While `enabled.value` is `true`, it invokes `callback` every `ms` milliseconds.
   - When `enabled.value` becomes `false`, the timer stops and `callback` is not invoked again (no leaked timers). Re-enabling starts it again.
   - It must never start a timer during SSR (browser-only).

### The demo page
The application's index route (`/`) must render a component that uses all four hooks and exposes exactly these `data-testid` attributes:

- An `<input>` with `data-testid="debounce-input"` bound to a source signal. Feed that source signal into `useDebouncedSignal(source, 500)` and render the debounced signal's current value as the text content of an element with `data-testid="debounced-value"`.
- An element with `data-testid="previous-value"` rendering `usePrevious(debounced)` of the debounced signal above (render an empty string when it is `undefined`).
- An `<input>` with `data-testid="throttle-input"` bound to a second source signal. Feed it into `useThrottledSignal(source, 500)` and render the throttled signal's current value as the text content of an element with `data-testid="throttled-value"`.
- An element with `data-testid="interval-count"` rendering a numeric counter (starting at `0`) that is incremented by `useInterval(callback, 200, enabled)`, where `callback` increments the counter. The `enabled` signal starts `false`.
- A `<button>` with `data-testid="toggle-timer"` that toggles the `enabled` signal between `false` and `true` on click.

Both text inputs start empty, so `debounced-value` and `throttled-value` both start as the empty string.

## Implementation Hints
- Project path: /home/user/qwik-app
- Use Qwik version 1.20.0 (`@builder.io/qwik` and `@builder.io/qwik-city` at `1.20.0`). The app must server-side render the index route.
- The four hooks must be defined and exported (by the exact names `useDebouncedSignal`, `useThrottledSignal`, `usePrevious`, and `useInterval`) from the file `/home/user/qwik-app/src/hooks/signals.ts`.
- Fixed timing values used by the demo page: debounce delay = `500` ms, throttle interval = `500` ms, interval tick = `200` ms.
- Timers created by the hooks must be cleaned up so they do not leak or fire after they are no longer relevant (e.g. after the source changes again, after the component is torn down, or after the interval is disabled).
- Rendering the index route on the server must not crash: the hooks must not touch browser-only globals during SSR.
- `npm run build` must complete successfully with no TypeScript, optimizer, or serialization errors.
- Start command (SSR dev server on a fixed port): `npm run dev -- --port 3000 --host`
- Port: 3000
- The index route is served at `/` and must contain the six `data-testid` elements listed above.

