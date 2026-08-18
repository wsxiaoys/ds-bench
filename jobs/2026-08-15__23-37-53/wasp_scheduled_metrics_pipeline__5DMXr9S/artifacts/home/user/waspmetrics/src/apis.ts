import { rollupMetrics } from "wasp/server/jobs";

export const ingestSample = async (req: any, res: any, context: any) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      return res.status(400).json({ error: "Idempotency-Key header is missing or empty" });
    }

    const { metric, value, recordedAt } = req.body;
    const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];

    if (!metric || typeof metric !== 'string' || !registeredMetrics.includes(metric)) {
      return res.status(400).json({ error: "metric is missing or is not a registered metric" });
    }

    if (value === undefined || value === null || typeof value !== 'number' || !Number.isFinite(value)) {
      return res.status(400).json({ error: "value is missing or is not a finite number" });
    }

    if (!recordedAt || typeof recordedAt !== 'string' || isNaN(Date.parse(recordedAt))) {
      return res.status(400).json({ error: "recordedAt is missing or is not a parsable ISO-8601 timestamp" });
    }

    // First, check if a sample with this idempotencyKey already exists
    const existingSample = await context.entities.Sample.findUnique({
      where: { idempotencyKey }
    });
    if (existingSample) {
      return res.status(200).json({ id: existingSample.id, duplicate: true });
    }

    // If not, try to insert it
    const newSample = await context.entities.Sample.create({
      data: {
        metric,
        value,
        recordedAt: new Date(recordedAt),
        idempotencyKey
      }
    });
    return res.status(201).json({ id: newSample.id, duplicate: false });
  } catch (error: any) {
    // Check if it's a unique constraint violation from Prisma (P2002)
    if (error.code === 'P2002') {
      const existingSample = await context.entities.Sample.findUnique({
        where: { idempotencyKey: req.headers['idempotency-key'] as string }
      });
      if (existingSample) {
        return res.status(200).json({ id: existingSample.id, duplicate: true });
      }
    }
    return res.status(500).json({ error: error.message || "Internal server error" });
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
    return res.status(500).json({ error: error.message || "Failed to submit job" });
  }
};

export const getDashboard = async (req: any, res: any, context: any) => {
  try {
    const registeredMetrics = ['error_rate', 'latency_ms', 'queue_depth'];
    
    // Fetch all MetricRollup records
    const rollups = await context.entities.MetricRollup.findMany();
    
    // Create a map for easy lookup
    const rollupMap = new Map();
    for (const rollup of rollups) {
      rollupMap.set(rollup.metric, rollup);
    }
    
    // Construct the response array
    const result = registeredMetrics.map(metric => {
      const rollup = rollupMap.get(metric);
      if (rollup) {
        return {
          metric: rollup.metric,
          count: rollup.count,
          p95: rollup.p95,
          avg: rollup.avg,
          delta: rollup.delta,
          updatedAt: rollup.updatedAt.toISOString(),
        };
      } else {
        return {
          metric,
          count: 0,
          p95: null,
          avg: null,
          delta: null,
          updatedAt: null,
        };
      }
    });
    
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};
