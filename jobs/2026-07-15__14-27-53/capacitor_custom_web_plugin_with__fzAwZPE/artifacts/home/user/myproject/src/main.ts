// Custom Capacitor plugin demo: MetricsAnalyzer
// This file is the application entry. It:
//   1. Registers the local `MetricsAnalyzer` Capacitor plugin (Web only).
//   2. Exposes the plugin and a global events buffer on `window` for automation.
//   3. Wires an `analysisComplete` listener that renders results into the DOM.

import { registerPlugin } from '@capacitor/core';
import type {
  AnalysisCompleteEvent,
  AnalysisResult,
  MetricsAnalyzerPlugin,
} from './definitions';
import { getMetricsAnalyzerLatestResult } from './state';

// -----------------------------------------------------------------------------
// Plugin registration
// -----------------------------------------------------------------------------

const MetricsAnalyzer = registerPlugin<MetricsAnalyzerPlugin>('MetricsAnalyzer', {
  web: () => import('./web').then((m) => new m.MetricsAnalyzerWeb()),
});

// Augment the global Window interface so TypeScript is happy with our additions.
declare global {
  interface Window {
    MetricsAnalyzer: MetricsAnalyzerPlugin;
    __analysisEvents: AnalysisCompleteEvent[];
  }
}

// -----------------------------------------------------------------------------
// Window globals (exposed for the headless browser / automation harness)
// -----------------------------------------------------------------------------

window.MetricsAnalyzer = MetricsAnalyzer;
window.__analysisEvents = [];

// -----------------------------------------------------------------------------
// DOM references and rendering helpers
// -----------------------------------------------------------------------------

const resultEl = document.getElementById('result') as HTMLPreElement | null;
const eventCountEl = document.getElementById('event-count') as HTMLSpanElement | null;

function renderResult(result: AnalysisResult | null): void {
  if (resultEl) {
    resultEl.textContent = result === null ? '' : JSON.stringify(result);
  }
}

function renderEventCount(count: number): void {
  if (eventCountEl) {
    eventCountEl.textContent = String(count);
  }
}

renderEventCount(0);
renderResult(null);

// -----------------------------------------------------------------------------
// analysisComplete listener
// -----------------------------------------------------------------------------

MetricsAnalyzer.addListener('analysisComplete', (event: AnalysisCompleteEvent) => {
  // 1) Record the raw event payload in the order it was received.
  window.__analysisEvents.push(event);

  // 2) Render the most recent analysis result. The event payload only carries
  //    `{ sequence, mean }`, so we read the full result back from the web
  //    implementation's module-scoped cache (kept in sync inside `analyze()`).
  renderResult(getMetricsAnalyzerLatestResult());

  // 3) Update the visible event counter.
  renderEventCount(window.__analysisEvents.length);
});
