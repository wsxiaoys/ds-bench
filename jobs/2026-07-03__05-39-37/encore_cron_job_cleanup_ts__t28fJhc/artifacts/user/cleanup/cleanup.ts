import { api, RawRequest, RawResponse } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { recordsDB } from "./records_db";

interface Record {
  id: number;
  data: string;
  created_at: string;
}

interface CreateRecordRequest {
  data: string;
  created_at?: string;
}

// POST /records – inserts a new record.
// If created_at is provided it is used, otherwise the current time is used.
export const createRecord = api(
  { method: "POST", path: "/records", expose: true },
  async (req: CreateRecordRequest): Promise<{ id: number }> => {
    const createdAt = req.created_at ?? new Date().toISOString();
    const row = await recordsDB.queryRow<{ id: number }>`
      INSERT INTO records (data, created_at)
      VALUES (${req.data}, ${createdAt})
      RETURNING id
    `;
    return { id: row!.id };
  }
);

// GET /records – returns all records ordered by id as a JSON array.
export const getRecords = api.raw(
  { method: "GET", path: "/records", expose: true },
  async (req: RawRequest, resp: RawResponse) => {
    const rows = await recordsDB.queryAll<Record>`
      SELECT id, data, created_at FROM records ORDER BY id
    `;
    resp.setHeader("Content-Type", "application/json");
    resp.end(JSON.stringify(rows));
  }
);

// POST /cleanup – deletes all records older than 1 hour.
export const cleanup = api(
  { method: "POST", path: "/cleanup", expose: true },
  async (): Promise<{ deleted: number }> => {
    const rows = await recordsDB.queryAll<{ id: number }>`
      DELETE FROM records
      WHERE created_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `;
    return { deleted: rows.length };
  }
);

// Cron job that calls the cleanup endpoint every hour.
export const _cleanupJob = new CronJob("cleanup-job", {
  title: "Cleanup stale records",
  every: "1h",
  endpoint: cleanup,
});