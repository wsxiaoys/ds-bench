import { api, rawApi } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { CronJob } from "encore.dev/cron";

// Define the database
const db = new SQLDatabase("records_db", {
  migrations: "./migrations",
});

interface DbRecord {
  id: number;
  data: string;
  created_at: string;
}

interface CreateRecordParams {
  data: string;
  created_at?: string;
}

interface CreateRecordResponse {
  id: number;
}

// POST /records
export const createRecord = api(
  { expose: true, method: "POST", path: "/records" },
  async (params: CreateRecordParams): Promise<CreateRecordResponse> => {
    const { data, created_at } = params;
    let row;
    if (created_at) {
      row = await db.queryRow`
        INSERT INTO records (data, created_at)
        VALUES (${data}, ${created_at})
        RETURNING id
      `;
    } else {
      row = await db.queryRow`
        INSERT INTO records (data)
        VALUES (${data})
        RETURNING id
      `;
    }
    if (!row) throw new Error("Failed to insert record");
    return { id: row.id as number };
  }
);

// GET /records
export const getRecords = rawApi(
  { expose: true, method: "GET", path: "/records" },
  async (req, resp) => {
    const rows = db.query`
      SELECT id, data, created_at
      FROM records
      ORDER BY id
    `;
    const records: DbRecord[] = [];
    for await (const row of rows) {
      records.push({
        id: row.id as number,
        data: row.data as string,
        created_at: (row.created_at as Date).toISOString(),
      });
    }
    resp.setHeader("Content-Type", "application/json");
    resp.end(JSON.stringify(records));
  }
);

interface CleanupResponse {
  deleted_count: number;
}

// POST /cleanup
export const cleanup = api(
  { expose: true, method: "POST", path: "/cleanup" },
  async (): Promise<CleanupResponse> => {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const result = await db.exec`
      DELETE FROM records
      WHERE created_at < ${oneHourAgo}
    `;
    return { deleted_count: Number(result.rowsAffected) };
  }
);

// Cron Job: cleanup-job every 1 hour
const _ = new CronJob("cleanup-job", {
  every: "1h",
  endpoint: cleanup,
});
