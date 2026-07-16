import { WebPlugin } from '@capacitor/core';
import type {
  AnalysisCompleteEvent,
  AnalysisOptions,
  AnalysisResult,
  MetricsAnalyzerPlugin,
  RunningTotal,
} from './definitions';
import {
  clearMetricsAnalyzerLatestResult,
  setMetricsAnalyzerLatestResult,
} from './state';

// Module-level counter shared by every MetricsAnalyzerWeb instance. The
// Capacitor proxy only ever creates one of these for the Web platform, but
// keeping the state at module scope (rather than on `this`) makes test reset
// trivial and survives accidental re-imports cleanly.
let analyzeCounter = 0;

export class MetricsAnalyzerWeb
  extends WebPlugin
  implements MetricsAnalyzerPlugin
{
  async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
    const values = options?.values ?? [];
    const count = values.length;

    // Bump the counter before notifying so listeners observe a 1-based
    // sequence number that matches the order in which `analyze` calls
    // resolve.
    analyzeCounter += 1;

    let result: AnalysisResult;
    if (count === 0) {
      result = {
        count: 0,
        sum: 0,
        mean: 0,
        min: 0,
        max: 0,
        stdDev: 0,
      };
    } else {
      let sum = 0;
      let min = values[0]!;
      let max = values[0]!;
      for (let i = 0; i < count; i++) {
        const v = values[i]!;
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const mean = sum / count;

      let squaredDeviations = 0;
      for (let i = 0; i < count; i++) {
        const diff = values[i]! - mean;
        squaredDeviations += diff * diff;
      }
      // Population standard deviation: divide by N (not N - 1).
      const stdDev = Math.sqrt(squaredDeviations / count);

      result = {
        count,
        sum,
        mean,
        min,
        max,
        stdDev,
      };
    }

    // Cache the latest result so other code (like the DOM listener in
    // `main.ts` that only receives `{ sequence, mean }` in the event
    // payload) can render the full result without an extra `analyze` call.
    setMetricsAnalyzerLatestResult(result);

    const event: AnalysisCompleteEvent = {
      sequence: analyzeCounter,
      mean: result.mean,
    };
    this.notifyListeners('analysisComplete', event);

    return result;
  }

  async getRunningTotal(): Promise<RunningTotal> {
    return { total: analyzeCounter };
  }
}

/** Test/dev helper: clear internal counters and the cached result. */
export function __resetMetricsAnalyzerState(): void {
  analyzeCounter = 0;
  clearMetricsAnalyzerLatestResult();
}
