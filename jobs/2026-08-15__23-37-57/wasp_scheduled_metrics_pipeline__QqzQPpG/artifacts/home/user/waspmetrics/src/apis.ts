import { rollupMetrics } from "wasp/server/jobs";

export const ingestSample = async (req: any, res: any, context: any) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    return res.status(400).json({ error: 'Idempotency-Key header is missing or empty' });
  }

  const { metric, value, recordedAt } = req.body;

  const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];
  if (!metric || typeof metric !== 'string' || !registeredMetrics.includes(metric)) {
    return res.status(400).json({ error: 'Invalid or missing metric' });
  }

  if (value === undefined || value === null || typeof value !== 'number' || !Number.isFinite(value)) {
    return res.status(400).json({ error: 'Invalid or missing value' });
  }

  if (!recordedAt || typeof recordedAt !== 'string') {
    return res.status(400).json({ error: 'recordedAt is missing or invalid' });
  }
  const parsedDate = Date.parse(recordedAt);
  if (isNaN(parsedDate)) {
    return res.status(400).json({ error: 'recordedAt is not a valid ISO-8601 timestamp' });
  }

  const { Sample } = context.entities;

  // 1. Check if idempotency key already exists
  const existing = await Sample.findUnique({
    where: { idempotencyKey }
  });

  if (existing) {
    return res.status(200).json({ id: existing.id, duplicate: true });
  }

  // 2. Try to create the sample
  try {
    const sample = await Sample.create({
      data: {
        metric,
        value,
        recordedAt: new Date(recordedAt),
        idempotencyKey
      }
    });
    return res.status(201).json({ id: sample.id, duplicate: false });
  } catch (error: any) {
    // Check if it's a unique constraint violation (P2002 in Prisma)
    if (error.code === 'P2002') {
      const concurrentExisting = await Sample.findUnique({
        where: { idempotencyKey }
      });
      if (concurrentExisting) {
        return res.status(200).json({ id: concurrentExisting.id, duplicate: true });
      }
    }
    throw error;
  }
};

export const enqueueRollup = async (req: any, res: any, context: any) => {
  try {
    const submittedJob = await rollupMetrics.submit({ reason: "manual" });
    return res.status(202).json({
      jobId: submittedJob.jobId,
      jobName: "rollupMetrics"
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getDashboard = async (req: any, res: any, context: any) => {
  const { RollupResult } = context.entities;
  const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];

  try {
    // Fetch all RollupResults
    const results = (await RollupResult.findMany({
      where: {
        metric: { in: registeredMetrics }
      }
    })) as any[];

    const resultsMap = new Map(results.map((r: any) => [r.metric, r]));

    const response = registeredMetrics.map((metric) => {
      const existing = resultsMap.get(metric) as any;
      if (existing) {
        return {
          metric: existing.metric,
          count: existing.count,
          p95: existing.p95,
          avg: existing.avg,
          delta: existing.delta,
          updatedAt: existing.updatedAt.toISOString()
        };
      } else {
        return {
          metric,
          count: 0,
          p95: null,
          avg: null,
          delta: null,
          updatedAt: null
        };
      }
    });

    // Sort by metric ascending
    response.sort((a, b) => a.metric.localeCompare(b.metric));

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
