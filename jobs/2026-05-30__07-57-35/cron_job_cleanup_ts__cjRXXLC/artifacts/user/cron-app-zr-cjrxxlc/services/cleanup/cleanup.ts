import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = new SQLDatabase("records_db", {
  migrations: "./migrations",
});

interface CreateRecordRequest {
  data: string;
  created_at?: string;
}

interface CreateRecordResponse {
  id: number;
}

interface RecordResponse {
  id: number;
  data: string;
  created_at: string;
}

export const createRecord = api(
  { method: "POST", path: "/records", expose: true },
  async (req: CreateRecordRequest): Promise<CreateRecordResponse> => {
    const createdAt = req.created_at ? new Date(req.created_at) : new Date();
    const row = await db.queryRow<{ id: number }>`
      INSERT INTO records (data, created_at)
      VALUES (${req.data}, ${createdAt})
      RETURNING id
    `;

    if (!row) {
      throw new Error("Failed to insert record");
    }

    return { id: row.id };
  }
);

export const listRecords = api(
  { method: "GET", path: "/records", expose: true },
  async (): Promise<RecordResponse[]> => {
    const rows = await db.queryAll<{
      id: number;
      data: string;
      created_at: Date;
    }>`
      SELECT id, data, created_at
      FROM records
      ORDER BY id
    `;

    return rows.map((row) => ({
      id: row.id,
      data: row.data,
      created_at: row.created_at.toISOString(),
    }));
  }
);

export const cleanup = api(
  { method: "POST", path: "/cleanup", expose: true },
  async (): Promise<{ deleted_count: number }> => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const deletedRows = await db.queryAll<{ id: number }>`
      DELETE FROM records
      WHERE created_at < ${cutoff}
      RETURNING id
    `;

    return { deleted_count: deletedRows.length };
  }
);

export const cleanupJob = new CronJob("cleanup-job", {
  every: "1h",
  endpoint: cleanup,
});
