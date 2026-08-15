const REGISTERED_METRICS = ["error_rate", "latency_ms", "queue_depth"];

function roundHalfAway(val: number, decimals: number = 3): number {
  const p = Math.pow(10, decimals);
  const sign = Math.sign(val);
  const absVal = Math.abs(val);
  const rounded = Math.round((absVal + Number.EPSILON) * p);
  return (sign * rounded) / p;
}

export const rollupMetrics = async (args: { reason?: string }, context: any) => {
  console.log(`[rollupMetrics] Starting rollup execution. Reason: ${args.reason || "unknown"}`);
  const now = new Date();

  try {
    for (const metric of REGISTERED_METRICS) {
      // 1. Find the greatest recordedAt among stored samples for this metric
      const latestSample = await context.entities.Sample.findFirst({
        where: { metric },
        orderBy: { recordedAt: "desc" }
      });

      if (!latestSample) {
        // No stored samples at all for this metric
        console.log(`[rollupMetrics] No samples found for metric: ${metric}. Persisting zero/null rollup.`);
        await context.entities.MetricRollup.upsert({
          where: { metric },
          update: {
            count: 0,
            p95: null,
            avg: null,
            delta: null,
            updatedAt: now
          },
          create: {
            metric,
            count: 0,
            p95: null,
            avg: null,
            delta: null,
            updatedAt: now
          }
        });
        continue;
      }

      const T = latestSample.recordedAt;
      const currentStart = new Date(T.getTime() - 3600 * 1000); // T - 3600s
      const currentEnd = T;

      const prevStart = new Date(T.getTime() - 7200 * 1000); // T - 7200s
      const prevEnd = currentStart;

      // 2. Fetch current window samples
      const currentSamples = await context.entities.Sample.findMany({
        where: {
          metric,
          recordedAt: {
            gt: currentStart,
            lte: currentEnd
          }
        }
      });

      // 3. Fetch previous window samples
      const prevSamples = await context.entities.Sample.findMany({
        where: {
          metric,
          recordedAt: {
            gt: prevStart,
            lte: prevEnd
          }
        }
      });

      const count = currentSamples.length;
      let avg: number | null = null;
      let p95: number | null = null;
      let delta: number | null = null;

      if (count > 0) {
        // Calculate average
        const sum = currentSamples.reduce((acc: number, s: any) => acc + s.value, 0);
        avg = roundHalfAway(sum / count, 3);

        // Calculate p95 (nearest-rank 95th percentile)
        const currentValues = currentSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
        const pos = Math.ceil(0.95 * count);
        const currentP95 = currentValues[pos - 1];
        p95 = currentP95;

        // Calculate p95 for previous window if it has samples
        const countPrev = prevSamples.length;
        if (countPrev > 0) {
          const prevValues = prevSamples.map((s: any) => s.value).sort((a: number, b: number) => a - b);
          const posPrev = Math.ceil(0.95 * countPrev);
          const p95Prev = prevValues[posPrev - 1];
          delta = roundHalfAway(currentP95 - p95Prev, 3);
        }
      } else {
        // Fallback (should not happen since T is the max recordedAt, so T is in current window)
        avg = null;
        p95 = null;
        delta = null;
      }

      console.log(`[rollupMetrics] Metric: ${metric}, count: ${count}, avg: ${avg}, p95: ${p95}, delta: ${delta}`);

      // 4. Persist the results
      await context.entities.MetricRollup.upsert({
        where: { metric },
        update: {
          count,
          p95,
          avg,
          delta,
          updatedAt: now
        },
        create: {
          metric,
          count,
          p95,
          avg,
          delta,
          updatedAt: now
        }
      });
    }

    console.log("[rollupMetrics] Rollup execution successfully completed.");
  } catch (error) {
    console.error("[rollupMetrics] Rollup execution failed with error:", error);
    throw error;
  }
};
