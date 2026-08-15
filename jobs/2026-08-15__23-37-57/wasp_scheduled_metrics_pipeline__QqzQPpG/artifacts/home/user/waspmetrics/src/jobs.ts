function roundHalfAwayFromZero(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const sign = Math.sign(num);
  const absoluteValue = Math.abs(num);
  const shifted = absoluteValue * factor;
  const rounded = Math.round(Number((shifted).toFixed(12)));
  return (sign * rounded) / factor;
}

export async function rollupMetrics(args: { reason?: string }, context: any) {
  console.log(`Running rollupMetrics. Reason: ${args?.reason || 'unknown'}`);
  const { Sample, RollupResult } = context.entities;
  const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];
  const now = new Date();

  for (const metric of registeredMetrics) {
    // 1. Find the latest sample's recordedAt for this metric
    const latestSample = await Sample.findFirst({
      where: { metric },
      orderBy: { recordedAt: 'desc' }
    });

    if (!latestSample) {
      // No stored samples at all: persist count 0 and nulls
      await RollupResult.upsert({
        where: { metric },
        create: {
          metric,
          count: 0,
          p95: null,
          avg: null,
          delta: null,
          updatedAt: now
        },
        update: {
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
    const currentWindowStart = new Date(T.getTime() - 3600 * 1000);
    const currentWindowEnd = T;
    const previousWindowStart = new Date(T.getTime() - 7200 * 1000);
    const previousWindowEnd = currentWindowStart;

    // Fetch current window samples sorted ascending by value
    const currentSamples = await Sample.findMany({
      where: {
        metric,
        recordedAt: {
          gt: currentWindowStart,
          lte: currentWindowEnd
        }
      },
      orderBy: { value: 'asc' }
    });

    // Fetch previous window samples sorted ascending by value
    const previousSamples = await Sample.findMany({
      where: {
        metric,
        recordedAt: {
          gt: previousWindowStart,
          lte: previousWindowEnd
        }
      },
      orderBy: { value: 'asc' }
    });

    const count = currentSamples.length;
    let avg: number | null = null;
    let p95: number | null = null;
    let delta: number | null = null;

    if (count > 0) {
      const sum = currentSamples.reduce((acc: number, s: any) => acc + s.value, 0);
      avg = roundHalfAwayFromZero(sum / count, 3);

      const p95Index = Math.ceil(0.95 * count) - 1;
      const p95Val = currentSamples[p95Index].value;
      p95 = p95Val;

      const prevCount = previousSamples.length;
      if (prevCount > 0) {
        const prevP95Index = Math.ceil(0.95 * prevCount) - 1;
        const prevP95 = previousSamples[prevP95Index].value;
        delta = roundHalfAwayFromZero(p95Val - prevP95, 3);
      }
    }

    await RollupResult.upsert({
      where: { metric },
      create: {
        metric,
        count,
        p95,
        avg,
        delta,
        updatedAt: now
      },
      update: {
        count,
        p95,
        avg,
        delta,
        updatedAt: now
      }
    });
  }
}
