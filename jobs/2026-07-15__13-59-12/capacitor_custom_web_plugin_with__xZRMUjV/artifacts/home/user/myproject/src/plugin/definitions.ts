import type { Plugin, PluginListenerHandle } from '@capacitor/core';

/**
 * Result returned by `analyze()`.
 */
export interface AnalysisResult {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
}

/**
 * Options accepted by `analyze()`.
 */
export interface AnalyzeOptions {
  values: number[];
}

/**
 * Result returned by `getRunningTotal()`.
 */
export interface RunningTotalResult {
  total: number;
}

/**
 * Payload emitted with every `analysisComplete` event.
 */
export interface AnalysisCompleteEvent {
  sequence: number;
  mean: number;
}

/**
 * Definitions interface for the MetricsAnalyzer plugin.
 *
 * Extending `Plugin` provides `addListener` / `removeAllListeners`
 * with proper typing, and we add a typed convenience listener for
 * the `analysisComplete` event.
 */
export interface MetricsAnalyzerPlugin extends Plugin {
  analyze(options: AnalyzeOptions): Promise<AnalysisResult>;
  getRunningTotal(): Promise<RunningTotalResult>;

  /**
   * Typed listener for the `analysisComplete` event.
   */
  addListener(
    eventName: 'analysisComplete',
    listenerFunc: (event: AnalysisCompleteEvent) => void,
  ): Promise<PluginListenerHandle>;
}