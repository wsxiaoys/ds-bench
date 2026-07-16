import { WebPlugin } from '@capacitor/core';
import type {
  AnalysisCompleteEvent,
  AnalysisResult,
  AnalyzeOptions,
  MetricsAnalyzerPlugin,
  RunningTotalResult,
} from './definitions';

/**
 * Web implementation of the MetricsAnalyzer plugin.
 *
 * Computes summary statistics for an array of numbers and emits an
 * `analysisComplete` event every time `analyze` is invoked.
 */
export class MetricsAnalyzerWeb
  extends WebPlugin
  implements MetricsAnalyzerPlugin
{
  /** Number of analyses performed since the page loaded. */
  private runningTotal = 0;

  async analyze(options: AnalyzeOptions): Promise<AnalysisResult> {
    const values = options?.values ?? [];
    this.runningTotal += 1;
    const sequence = this.runningTotal;

    const count = values.length;
    if (count === 0) {
      const emptyResult: AnalysisResult = {
        count: 0,
        sum: 0,
        mean: 0,
        min: 0,
        max: 0,
        stdDev: 0,
      };

      this.notifyListeners('analysisComplete', {
        sequence,
        mean: 0,
      } satisfies AnalysisCompleteEvent);

      return emptyResult;
    }

    let sum = 0;
    let min = values[0];
    let max = values[0];
    for (const v of values) {
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const mean = sum / count;

    // Population standard deviation: divide by N (not N-1).
    let squaredDeviations = 0;
    for (const v of values) {
      const diff = v - mean;
      squaredDeviations += diff * diff;
    }
    const stdDev = Math.sqrt(squaredDeviations / count);

    const result: AnalysisResult = {
      count,
      sum,
      mean,
      min,
      max,
      stdDev,
    };

    this.notifyListeners('analysisComplete', {
      sequence,
      mean,
    } satisfies AnalysisCompleteEvent);

    return result;
  }

  async getRunningTotal(): Promise<RunningTotalResult> {
    return { total: this.runningTotal };
  }
}