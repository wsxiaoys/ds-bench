import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

const runId = process.env.ZEALT_RUN_ID!;

crons.hourly(
  `cleanup-sessions-${runId}`,
  { minuteUTC: 0 },
  api.sessions.cleanup
);

export default crons;