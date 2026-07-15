import { MetricsAnalyzer } from './index';
import type { AnalysisCompleteEvent } from './definitions';

declare global {
  interface Window {
    MetricsAnalyzer: typeof MetricsAnalyzer;
    __analysisEvents: AnalysisCompleteEvent[];
  }
}

// Expose the plugin and events array on window
window.MetricsAnalyzer = MetricsAnalyzer;
window.__analysisEvents = [];

// Listen for the analysisComplete event
MetricsAnalyzer.addListener('analysisComplete', (event) => {
  window.__analysisEvents.push(event);
  const eventCountEl = document.getElementById('event-count');
  if (eventCountEl) {
    eventCountEl.textContent = String(window.__analysisEvents.length);
  }
});

// Wrap analyze to update the DOM with the most recent analysis result
const originalAnalyze = MetricsAnalyzer.analyze.bind(MetricsAnalyzer);
MetricsAnalyzer.analyze = async (options) => {
  const result = await originalAnalyze(options);
  const resultEl = document.getElementById('result');
  if (resultEl) {
    resultEl.textContent = JSON.stringify(result, null, 2);
  }
  return result;
};

// Wire up the manual testing UI
document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyze-btn');
  const valuesInput = document.getElementById('values-input') as HTMLInputElement;

  if (analyzeBtn && valuesInput) {
    analyzeBtn.addEventListener('click', async () => {
      const text = valuesInput.value.trim();
      let values: number[] = [];
      if (text) {
        values = text
          .split(',')
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !isNaN(v));
      }
      try {
        await MetricsAnalyzer.analyze({ values });
      } catch (err) {
        console.error('Analysis failed:', err);
      }
    });
  }
});
