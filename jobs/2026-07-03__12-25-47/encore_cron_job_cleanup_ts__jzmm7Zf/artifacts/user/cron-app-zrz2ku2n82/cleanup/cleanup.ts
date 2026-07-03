import { api } from "encore.dev/api";
import { recordsDB } from "./db";

interface CreateRecordRequest {
  data: string;
  created_at?: string;
}

interface CreateRecordResponse {
  id: number;
}

interface RecordItem {
  id: number;
  data: string;
  created_at: string;
}

interface ListRecordsResponse {
  records: RecordItem[];
}

interface CleanupResponse {
  deleted: number;
}

export const createRecord = api(
  { method: "POST", path: "/records" },
  async (req: CreateRecordRequest): Promise<CreateRecordResponse> => {
    let createdAt: string;
    if (req.created_at) {
      createdAt = req.created_at;
    } else {
      createdAt = new Date().toISOString();
    }
    const row = await recordsDB.queryRow<{ id: number }>`
      INSERT INTO records (data, created_at)
      VALUES (${req.data}, ${createdAt}::timestamp)
      RETURNING id
    `;
    return { id: row!.id };
  }
);

export const listRecords = api(
  { method: "GET", path: "/records" },
  async (): Promise<ListRecordsResponse> => {
    const rows = await recordsDB.query<RecordItem>`
      SELECT id, data, created_at FROM records ORDER BY id
    `;
    const records: RecordItem[] = [];
    for await (const row of rows) {
      records.push({
        id: row.id,
        data: row.data,
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
      });
    }
    return { records };
  }
);

export const cleanupRecords = api(
  { method: "POST", path: "/cleanup" },
  async (): Promise<CleanupResponse> => {
    const row = await recordsDB.queryRow<{ count: number }>`
      WITH deleted AS (
        DELETE FROM records WHERE created_at < NOW() - INTERVAL '1 hour'
        RETURNING 1
      )
      SELECT COUNT(*)::int AS count FROM deleted
    `;
    return { deleted: row?.count ?? 0 };
  }
);
