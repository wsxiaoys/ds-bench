import { cron } from "encore.dev/cron";
import { cleanupRecords } from "./cleanup";

const cleanupJob = cron({
  name: "cleanup-job",
  every: "1h",
  endpoint: cleanupRecords,
});
