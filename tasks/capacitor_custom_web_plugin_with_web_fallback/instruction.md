# Custom Capacitor Plugin with a Web Implementation

## Background
Build a **custom local Capacitor plugin** (not published to npm) that is fully functional in the browser through a Web implementation. The plugin exposes a small statistics engine and emits events to listeners. The host app is a Vite + TypeScript project. No native platforms (Android/iOS) are involved: the plugin must work purely on the Web via a class that extends Capacitor's `WebPlugin`.

## Requirements
- Register the plugin with `registerPlugin` from `@capacitor/core` using the plugin name `MetricsAnalyzer`.
- Provide a TypeScript **definitions** interface that extends Capacitor's `Plugin` type and declares the methods plus a typed `analysisComplete` listener.
- Provide a **Web implementation** class that extends `WebPlugin` and `implements` the definitions interface.
- The plugin must implement:
  - `analyze(options: { values: number[] })` returning summary statistics.
  - `getRunningTotal()` returning how many analyses have been performed since page load.
  - An `analysisComplete` event emitted through `notifyListeners(...)` every time `analyze` runs.
- Wire the plugin into the web page: register an `analysisComplete` listener when the page loads and render results into the DOM.

## Implementation Hints
- Register the web implementation using the second argument of `registerPlugin`, e.g. `registerPlugin('MetricsAnalyzer', { web: () => import('./web').then(m => new m.MetricsAnalyzerWeb()) })`.
- Extend `Plugin` in your definitions so that `addListener` / `removeAllListeners` are correctly typed.
- Emit events from the web implementation with `this.notifyListeners('analysisComplete', payload)` inside `analyze`.
- `stdDev` is the **population** standard deviation (divide the summed squared deviations by N, not N-1).
- Project path: /home/user/myproject
- Build command: `npm run build`, producing a static site under `dist/` (default Vite output).
- The app must run without a dev server; it is verified by serving the built `dist/` folder as static files and loading it in a headless browser at the site root.
- From the app entry code, expose the following on `window` so the plugin can be driven from a headless browser:
  - `window.MetricsAnalyzer`: the object returned by `registerPlugin`.
  - `window.__analysisEvents`: an array to which every received `analysisComplete` event payload is appended, in the order received.
- `analyze({ values })` must resolve to an object with exactly the keys `count`, `sum`, `mean`, `min`, `max`, `stdDev` (all numbers). For an empty `values` array, every key must be `0`.
- `getRunningTotal()` must resolve to `{ total: number }`, where `total` equals the number of `analyze` calls performed since page load.
- Each `analysisComplete` event payload must contain exactly the keys `sequence` (a 1-based integer counting analyses since load) and `mean` (the mean of that analysis).
- Render the most recent analysis result as JSON text into a DOM element with `id="result"`, and the current number of received events into a DOM element with `id="event-count"`.

