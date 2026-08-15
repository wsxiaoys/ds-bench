import { rollupMetrics } from "wasp/server/jobs";

const registeredMetrics = ["error_rate", "latency_ms", "queue_depth"];

export async function ingestSample(req: any, res: any, context: any) {
  // 1. Validate Idempotency-Key header
  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    return res.status(400).json({ error: "Idempotency-Key header is missing or empty" });
  }

  const { metric, value, recordedAt } = req.body;

  // 2. Validate metric
  if (!metric || typeof metric !== "string" || !registeredMetrics.includes(metric)) {
    return res.status(400).json({ error: "metric must be one of the registered metrics" });
  }

  // 3. Validate value
  if (value === undefined || value === null || typeof value !== "number" || !Number.isFinite(value)) {
    return res.status(400).json({ error: "value must be a finite number" });
  }

  // 4. Validate recordedAt
  if (typeof recordedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(recordedAt)) {
    return res.status(400).json({ error: "recordedAt must be a valid ISO-8601 timestamp" });
  }
  const date = new Date(recordedAt);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: "recordedAt is not a parsable ISO-8601 timestamp" });
  }

  try {
    const sample = await context.entities.Sample.create({
      data: {
        metric,
        value,
        recordedAt: date,
        idempotencyKey,
      },
    });
    return res.status(201).json({ id: sample.id, duplicate: false });
  } catch (error: any) {
    if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
      const existing = await context.entities.Sample.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return res.status(200).json({ id: existing.id, duplicate: true });
      }
    }
    throw error;
  }
}

export async function enqueueRollup(req: any, res: any, context: any) {
  try {
    const submittedJob = await rollupMetrics.submit({ reason: "manual" });
    return res.status(202).json({
      jobId: submittedJob.jobId,
      jobName: "rollupMetrics",
    });
  } catch (err: any) {
    console.error("Failed to enqueue rollup job:", err);
    return res.status(500).json({ error: err.message || "Failed to enqueue rollup job" });
  }
}

export async function getDashboard(req: any, res: any, context: any) {
  try {
    const results = await context.entities.RollupResult.findMany();
    const sortedMetrics = [...registeredMetrics].sort((a, b) => a.localeCompare(b));

    const response = sortedMetrics.map((metric) => {
      const result = results.find((r: any) => r.metric === metric);
      if (result) {
        return {
          metric: result.metric,
          count: result.count,
          p95: result.p95,
          avg: result.avg,
          delta: result.delta,
          updatedAt: result.updatedAt.toISOString(),
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

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("Failed to fetch dashboard data:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch dashboard data" });
  }
}
