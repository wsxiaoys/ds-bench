import type { AnalysisResult } from './definitions';

/**
 * Tiny module shared between the entry code and the Web implementation so
 * the listener in `main.ts` can read the most recent `analyze({values})`
 * result without having to import the entire plugin (which is loaded
 * lazily through `registerPlugin`).
 */
let lastResult: AnalysisResult | null = null;

export function setMetricsAnalyzerLatestResult(result: AnalysisResult): void {
  lastResult = result;
}

export function getMetricsAnalyzerLatestResult(): AnalysisResult | null {
  return lastResult;
}

export function clearMetricsAnalyzerLatestResult(): void {
  lastResult = null;
}
