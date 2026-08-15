import { rollupMetrics } from "wasp/server/jobs";

const REGISTERED_METRICS = ["error_rate", "latency_ms", "queue_depth"];

function isValidISO8601(str: any): boolean {
  if (typeof str !== "string") return false;
  // Regex checking for YYYY-MM-DDTHH:mm:ss with optional milliseconds and timezone offset
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
  if (!iso8601Regex.test(str)) return false;
  const timestamp = Date.parse(str);
  return !isNaN(timestamp);
}

export const ingestSample = async (req: any, res: any, context: any) => {
  const idempotencyKey = req.headers["idempotency-key"];
  
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    return res.status(400).json({ error: "Idempotency-Key header is missing or empty" });
  }

  const { metric, value, recordedAt } = req.body;

  if (!metric || typeof metric !== "string" || !REGISTERED_METRICS.includes(metric)) {
    return res.status(400).json({ error: "Invalid or unregistered metric" });
  }

  if (value === undefined || value === null || typeof value !== "number" || !Number.isFinite(value)) {
    return res.status(400).json({ error: "Value is missing or not a finite number" });
  }

  if (!recordedAt || !isValidISO8601(recordedAt)) {
    return res.status(400).json({ error: "recordedAt is missing or is not a parsable ISO-8601 timestamp" });
  }

  try {
    const sample = await context.entities.Sample.create({
      data: {
        metric,
        value,
        recordedAt: new Date(recordedAt),
        idempotencyKey
      }
    });

    return res.status(201).json({ id: sample.id, duplicate: false });
  } catch (error: any) {
    if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
      const existing = await context.entities.Sample.findUnique({
        where: { idempotencyKey }
      });
      if (existing) {
        return res.status(200).json({ id: existing.id, duplicate: true });
      }
    }
    console.error("Ingest sample error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
    console.error("Failed to enqueue rollup job:", error);
    return res.status(500).json({ error: "Failed to enqueue rollup job" });
  }
};

export const getDashboard = async (req: any, res: any, context: any) => {
  try {
    const rollups = await context.entities.MetricRollup.findMany({
      where: {
        metric: { in: REGISTERED_METRICS }
      }
    });

    const rollupMap = new Map<string, any>(rollups.map((r: any) => [r.metric, r]));

    const result = [...REGISTERED_METRICS].sort().map(metric => {
      const row = rollupMap.get(metric);
      if (row) {
        return {
          metric: row.metric,
          count: row.count,
          p95: row.p95,
          avg: row.avg,
          delta: row.delta,
          updatedAt: row.updatedAt.toISOString()
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

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Failed to fetch dashboard:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard" });
  }
};
