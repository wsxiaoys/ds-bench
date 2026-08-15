function roundTo3(num: number): number {
  const sign = Math.sign(num);
  const absNum = Math.abs(num);
  return (sign * Math.round(absNum * 1000)) / 1000;
}

export const rollupMetrics = async (args: any, context: any) => {
  const now = new Date();
  const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];

  console.log(`[rollupMetrics] Starting rollup run. Reason: ${args?.reason || 'unknown'}`);

  for (const metric of registeredMetrics) {
    try {
      const samples = await context.entities.Sample.findMany({
        where: { metric }
      });

      let count = 0;
      let p95: number | null = null;
      let avg: number | null = null;
      let delta: number | null = null;

      if (samples.length > 0) {
        const times = samples.map((s: any) => new Date(s.recordedAt).getTime());
        const T_ms = Math.max(...times);

        const currentWindowSamples = samples.filter((s: any) => {
          const t = new Date(s.recordedAt).getTime();
          return t > T_ms - 3600 * 1000 && t <= T_ms;
        });

        const previousWindowSamples = samples.filter((s: any) => {
          const t = new Date(s.recordedAt).getTime();
          return t > T_ms - 7200 * 1000 && t <= T_ms - 3600 * 1000;
        });

        count = currentWindowSamples.length;

        if (count > 0) {
          const sum = currentWindowSamples.reduce((acc: number, s: any) => acc + s.value, 0);
          avg = roundTo3(sum / count);

          const sortedCurrentVals = currentWindowSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
          const pos1 = Math.ceil(0.95 * count);
          const currentP95 = sortedCurrentVals[pos1 - 1];
          p95 = currentP95;

          if (previousWindowSamples.length > 0) {
            const prevCount = previousWindowSamples.length;
            const sortedPrevVals = previousWindowSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
            const prevPos1 = Math.ceil(0.95 * prevCount);
            const prevP95 = sortedPrevVals[prevPos1 - 1];
            delta = roundTo3(currentP95 - prevP95);
          }
        }
      }

      await context.entities.MetricRollup.upsert({
        where: { metric },
        update: {
          count,
          p95,
          avg,
          delta,
          updatedAt: now,
        },
        create: {
          metric,
          count,
          p95,
          avg,
          delta,
          updatedAt: now,
        }
      });

      console.log(`[rollupMetrics] Persisted rollup for ${metric}: count=${count}, avg=${avg}, p95=${p95}, delta=${delta}`);
    } catch (error) {
      console.error(`[rollupMetrics] Failed to rollup ${metric}:`, error);
    }
  }

  console.log('[rollupMetrics] Rollup run complete.');
};
