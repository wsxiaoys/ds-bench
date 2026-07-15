import { registerPlugin } from '@capacitor/core';
import type { MetricsAnalyzerPlugin } from './definitions';

/**
 * Register the MetricsAnalyzer plugin with Capacitor, supplying the
 * web implementation via a lazy dynamic import.
 */
export const MetricsAnalyzer = registerPlugin<MetricsAnalyzerPlugin>(
  'MetricsAnalyzer',
  {
    web: () => import('./web').then((m) => new m.MetricsAnalyzerWeb()),
  },
);

export type {
  AnalysisCompleteEvent,
  AnalysisResult,
  AnalyzeOptions,
  MetricsAnalyzerPlugin,
  RunningTotalResult,
} from './definitions';
export { MetricsAnalyzerWeb } from './web';