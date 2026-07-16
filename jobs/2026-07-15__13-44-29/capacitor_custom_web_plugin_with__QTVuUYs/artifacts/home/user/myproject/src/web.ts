import { WebPlugin } from '@capacitor/core';
import type { MetricsAnalyzerPlugin, AnalysisResult, RunningTotalResult } from './definitions';

export class MetricsAnalyzerWeb extends WebPlugin implements MetricsAnalyzerPlugin {
  private totalAnalyses = 0;

  constructor() {
    super({
      name: 'MetricsAnalyzer',
      platforms: ['web'],
    });
  }

  async analyze(options: { values: number[] }): Promise<AnalysisResult> {
    this.totalAnalyses++;
    const { values } = options;

    if (!values || values.length === 0) {
      const result: AnalysisResult = {
        count: 0,
        sum: 0,
        mean: 0,
        min: 0,
        max: 0,
        stdDev: 0,
      };

      this.notifyListeners('analysisComplete', {
        sequence: this.totalAnalyses,
        mean: 0,
      });

      return result;
    }

    const count = values.length;
    let sum = 0;
    let min = values[0];
    let max = values[0];

    for (const val of values) {
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    const mean = sum / count;

    let sumSqDev = 0;
    for (const val of values) {
      sumSqDev += (val - mean) ** 2;
    }
    const variance = sumSqDev / count;
    const stdDev = Math.sqrt(variance);

    const result: AnalysisResult = {
      count,
      sum,
      mean,
      min,
      max,
      stdDev,
    };

    this.notifyListeners('analysisComplete', {
      sequence: this.totalAnalyses,
      mean,
    });

    return result;
  }

  async getRunningTotal(): Promise<RunningTotalResult> {
    return {
      total: this.totalAnalyses,
    };
  }
}
