import { MetricsAnalyzer } from './plugin';
import type { AnalysisCompleteEvent } from './plugin';

// Expose the plugin instance so a headless browser can drive it.
declare global {
  interface Window {
    MetricsAnalyzer: typeof MetricsAnalyzer;
    __analysisEvents: AnalysisCompleteEvent[];
  }
}

// Array to which every received `analysisComplete` event payload is appended,
// in the order received.
window.__analysisEvents = [];

// Register an `analysisComplete` listener when the page loads so that
// every emitted event is captured and the event-count is rendered.
MetricsAnalyzer.addListener('analysisComplete', (event) => {
  window.__analysisEvents.push(event);

  const eventCountEl = document.getElementById('event-count');
  if (eventCountEl) {
    eventCountEl.textContent = String(window.__analysisEvents.length);
  }
});

/**
 * Render the most recent analysis result as JSON text into the result element.
 */
function renderResult(result: unknown): void {
  const resultEl = document.getElementById('result');
  if (resultEl) {
    resultEl.textContent = JSON.stringify(result, null, 2);
  }
}

// Expose the plugin on `window` as required, wrapping `analyze` so that the
// most recent result is rendered into the DOM every time it is called.
// All other method/property access delegates transparently to the original
// plugin proxy returned by `registerPlugin`.
window.MetricsAnalyzer = new Proxy(MetricsAnalyzer, {
  get(target, prop) {
    if (prop === 'analyze') {
      return async (options: { values: number[] }) => {
        const result = await target.analyze(options);
        renderResult(result);
        return result;
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Reflect.get(target, prop as any) as any;
  },
});