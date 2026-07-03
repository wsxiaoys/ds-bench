import { api } from "encore.dev/api";
import { recordsDB } from "./db/db";

interface RecordRow {
  id: number;
  data: string;
  created_at: Date;
}

interface ListRecordsResponse {
  records: RecordRow[];
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
    let createdAt: Date;
    if (params.created_at) {
      createdAt = new Date(params.created_at);
    } else {
      createdAt = new Date();
    }
    const row = await recordsDB.queryRow<{ id: number }>`
      INSERT INTO records (data, created_at)
      VALUES (${params.data}, ${createdAt})
      RETURNING id
    `;
    return { id: row!.id };
  }
);

// GET /records
export const listRecords = api(
  { expose: true, method: "GET", path: "/records" },
  async (): Promise<ListRecordsResponse> => {
    const rows = await recordsDB.queryAll<RecordRow>`
      SELECT id, data, created_at FROM records ORDER BY id
    `;
    return { records: rows };
  }
);
