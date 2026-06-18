import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { CronJob } from "encore.dev/cron";
import type { IncomingMessage, ServerResponse } from "node:http";

const db = new SQLDatabase("records_db", {
  migrations: "./migrations",
});

interface Record {
  id: number;
  data: string;
  created_at: string;
}

interface InsertRecordRequest {
  data: string;
  created_at?: string;
}

interface InsertRecordResponse {
  id: number;
}

export const insertRecord = api(
  { expose: true, method: "POST", path: "/records" },
  async (req: InsertRecordRequest): Promise<InsertRecordResponse> => {
    let row;
    if (req.created_at) {
      row = await db.queryRow`
        INSERT INTO records (data, created_at)
        VALUES (${req.data}, ${req.created_at}::timestamptz)
        RETURNING id
      `;
    } else {
      row = await db.queryRow`
        INSERT INTO records (data)
        VALUES (${req.data})
        RETURNING id
      `;
    }
    return { id: row!.id };
  }
);

export const getRecords = api.raw(
  { expose: true, method: "GET", path: "/records" },
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const rows = await db.query`
        SELECT id, data, created_at
        FROM records
        ORDER BY id
      `;
      const records: Record[] = [];
      for await (const row of rows) {
        records.push({
          id: row.id,
          data: row.data,
          created_at: row.created_at,
        });
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(records));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    }
  }
);

interface CleanupResponse {
  deleted_count: number;
}

export const cleanupRecords = api(
  { expose: true, method: "POST", path: "/cleanup" },
  async (): Promise<CleanupResponse> => {
    // Delete records older than 1 hour
    const row = await db.queryRow`
      WITH deleted AS (
        DELETE FROM records
        WHERE created_at < NOW() - INTERVAL '1 hour'
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
    `;
    return { deleted_count: Number(row?.count || 0) };
  }
);

const cleanupJob = new CronJob("cleanup-job", {
  title: "Cleanup Job",
  every: "1h",
  endpoint: cleanupRecords,
});
