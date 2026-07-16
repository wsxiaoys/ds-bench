import type { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface AnalysisResult {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface RunningTotalResult {
  total: number;
}

export interface AnalysisCompleteEvent {
  sequence: number;
  mean: number;
}

export interface MetricsAnalyzerPlugin extends Plugin {
  analyze(options: { values: number[] }): Promise<AnalysisResult>;
  getRunningTotal(): Promise<RunningTotalResult>;
  addListener(
    eventName: 'analysisComplete',
    listenerFunc: (event: AnalysisCompleteEvent) => void,
  ): Promise<PluginListenerHandle>;
}
