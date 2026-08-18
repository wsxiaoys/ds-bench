export function roundHalfAwayFromZero(num: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals);
  const val = num * factor;
  let rounded: number;
  if (val >= 0) {
    rounded = Math.floor(val + 0.5);
  } else {
    rounded = Math.ceil(val - 0.5);
  }
  return rounded / factor;
}

export async function rollupMetrics(args: { reason?: string }, context: any) {
  console.log("Starting rollupMetrics background job with args:", args);
  const runTimestamp = new Date();
  const registeredMetrics = ["error_rate", "latency_ms", "queue_depth"];

  for (const metric of registeredMetrics) {
    try {
      const samples = await context.entities.Sample.findMany({
        where: { metric },
      });

      if (samples.length === 0) {
        await context.entities.RollupResult.upsert({
          where: { metric },
          create: {
            metric,
            count: 0,
            p95: null,
            avg: null,
            delta: null,
            updatedAt: runTimestamp,
          },
          update: {
            count: 0,
            p95: null,
            avg: null,
            delta: null,
            updatedAt: runTimestamp,
          },
        });
        continue;
      }

      const times = samples.map((s: any) => s.recordedAt.getTime());
      const T_time = Math.max(...times);

      const currentWindowSamples = samples.filter((s: any) => {
        const t = s.recordedAt.getTime();
        return t > T_time - 3600 * 1000 && t <= T_time;
      });

      const prevWindowSamples = samples.filter((s: any) => {
        const t = s.recordedAt.getTime();
        return t > T_time - 7200 * 1000 && t <= T_time - 3600 * 1000;
      });

      const count = currentWindowSamples.length;
      let avg: number | null = null;
      let p95: number | null = null;
      let delta: number | null = null;

      if (count > 0) {
        const sum = currentWindowSamples.reduce((acc: number, s: any) => acc + s.value, 0);
        avg = roundHalfAwayFromZero(sum / count, 3);

        const currentSorted = currentWindowSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
        const p95Index = Math.ceil(0.95 * count) - 1;
        p95 = currentSorted[p95Index];

        if (prevWindowSamples.length > 0) {
          const prevCount = prevWindowSamples.length;
          const prevSorted = prevWindowSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
          const prevP95Index = Math.ceil(0.95 * prevCount) - 1;
          const prevP95 = prevSorted[prevP95Index];
          delta = roundHalfAwayFromZero(p95! - prevP95, 3);
        }
      }

      await context.entities.RollupResult.upsert({
        where: { metric },
        create: {
          metric,
          count,
          p95,
          avg,
          delta,
          updatedAt: runTimestamp,
        },
        update: {
          count,
          p95,
          avg,
          delta,
          updatedAt: runTimestamp,
        },
      });
    } catch (err) {
      console.error(`Error processing rollup for metric ${metric}:`, err);
      throw err;
    }
  }

  console.log("rollupMetrics background job completed successfully at:", runTimestamp);
}
