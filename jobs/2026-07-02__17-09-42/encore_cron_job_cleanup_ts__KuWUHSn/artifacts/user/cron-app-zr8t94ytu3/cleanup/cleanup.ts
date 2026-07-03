import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { recordsDB } from "./db/db";

interface CleanupResponse {
  deleted: number;
}

// POST /cleanup
export const cleanup = api(
  { expose: true, method: "POST", path: "/cleanup" },
  async (): Promise<CleanupResponse> => {
    const rows = await recordsDB.queryAll<{ id: number }>`
      DELETE FROM records
      WHERE created_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `;
    return { deleted: rows.length };
  }
);

// Cron Job: every 1 hour.
new CronJob("cleanup-job", {
  every: "1h",
  endpoint: cleanup,
});
