import type { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface AnalysisOptions {
  values: number[];
}

export interface AnalysisResult {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface AnalysisCompleteEvent {
  sequence: number;
  mean: number;
}

export interface RunningTotal {
  total: number;
}

export interface MetricsAnalyzerPlugin extends Plugin {
  analyze(options: AnalysisOptions): Promise<AnalysisResult>;
  getRunningTotal(): Promise<RunningTotal>;
  addListener(
    eventName: 'analysisComplete',
    listenerFunc: (event: AnalysisCompleteEvent) => void,
  ): Promise<PluginListenerHandle>;
}
