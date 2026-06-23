import { SQLDatabase } from "encore.dev/storage/sqldb";
import { cron } from "encore.dev/cron";
import { api } from "encore.dev/api";

// Define the database
export const recordsDB = new SQLDatabase("records_db", {
  migrations: "./migrations",
});

// Define types
interface RecordItem {
  id: number;
  data: string;
  created_at: string;
}

interface CreateRecordRequest {
  data: string;
  created_at?: string;
}

interface CreateRecordResponse {
  id: number;
}

interface GetRecordsResponse {
  records: RecordItem[];
}

interface CleanupResponse {
  deleted_count: number;
}

// POST /records - Insert a new record
export const createRecord = api(
  { method: "POST", path: "/records", expose: true },
  async (req: CreateRecordRequest): Promise<CreateRecordResponse> => {
    const createdAt = req.created_at ?? new Date().toISOString();
    const result = await recordsDB.queryRow`
      INSERT INTO records (data, created_at) VALUES (${req.data}, ${createdAt}::timestamp) RETURNING id
    `;
    return { id: result!.id };
  }
);

// GET /records - Get all records ordered by id
export const getRecords = api(
  { method: "GET", path: "/records", expose: true },
  async (): Promise<GetRecordsResponse> => {
    const rows = await recordsDB.query`
      SELECT id, data, created_at FROM records ORDER BY id
    `;
    const records: RecordItem[] = [];
    for await (const row of rows) {
      records.push({
        id: row.id,
        data: row.data,
        created_at: row.created_at,
      });
    }
    return { records };
  }
);

// POST /cleanup - Delete records older than 1 hour
export const cleanup = api(
  { method: "POST", path: "/cleanup", expose: true },
  async (): Promise<CleanupResponse> => {
    const result = await recordsDB.queryRow`
      WITH deleted AS (
        DELETE FROM records WHERE created_at < NOW() - INTERVAL '1 hour' RETURNING id
      ) SELECT count(*)::int AS deleted_count FROM deleted
    `;
    return { deleted_count: result?.deleted_count ?? 0 };
  }
);

// Cron job that runs every 1 hour
const _cleanupJob = cron("cleanup-job", {
  every: "1h",
  endpoint: cleanup,
});