import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { CronJob } from "encore.dev/cron";

// Define the database
const db = new SQLDatabase("records_db", {
  migrations: "./migrations",
});

// Interfaces
interface InsertRecordRequest {
  data: string;
  created_at?: string;
}

interface InsertRecordResponse {
  id: number;
}

interface Record {
  id: number;
  data: string;
  created_at: string;
}

interface CleanupResponse {
  deleted_count: number;
}

// POST /records - Insert a new record
export const insertRecord = api(
  { method: "POST", path: "/records", expose: true },
  async (req: InsertRecordRequest): Promise<InsertRecordResponse> => {
    const createdAt = req.created_at ? new Date(req.created_at) : new Date();
    const row = await db.queryRow<{ id: number }>`
      INSERT INTO records (data, created_at)
      VALUES (${req.data}, ${createdAt})
      RETURNING id
    `;
    return { id: row!.id };
  }
);

// GET /records - Return all records
export const getRecords = api(
  { method: "GET", path: "/records", expose: true },
  async (): Promise<{ records: Record[] }> => {
    const rows: Record[] = [];
    for await (const row of db.query<{ id: number; data: string; created_at: Date }>`
      SELECT id, data, created_at FROM records ORDER BY id
    `) {
      rows.push({
        id: row.id,
        data: row.data,
        created_at: row.created_at.toISOString(),
      });
    }
    return { records: rows };
  }
);

// POST /cleanup - Delete records older than 1 hour
export const cleanupRecords = api(
  { method: "POST", path: "/cleanup", expose: true },
  async (): Promise<CleanupResponse> => {
    const result = await db.queryRow<{ count: number }>`
      WITH deleted AS (
        DELETE FROM records
        WHERE created_at < NOW() - INTERVAL '1 hour'
        RETURNING id
      )
      SELECT COUNT(*) AS count FROM deleted
    `;
    return { deleted_count: result ? Number(result.count) : 0 };
  }
);

// Cron job - runs every 1 hour
const _cleanupJob = new CronJob("cleanup-job", {
  title: "Cleanup stale records",
  every: "1h",
  endpoint: cleanupRecords,
});
