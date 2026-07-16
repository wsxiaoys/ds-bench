import { registerPlugin } from '@capacitor/core';
import type { MetricsAnalyzerPlugin } from './definitions';

const MetricsAnalyzer = registerPlugin<MetricsAnalyzerPlugin>('MetricsAnalyzer', {
  web: () => import('./web').then(m => new m.MetricsAnalyzerWeb()),
});

export * from './definitions';
export { MetricsAnalyzer };
