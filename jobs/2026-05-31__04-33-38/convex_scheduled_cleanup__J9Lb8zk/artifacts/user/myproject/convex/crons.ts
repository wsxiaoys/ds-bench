import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

const runId = process.env.ZEALT_RUN_ID;
crons.interval(
  `cleanup-sessions-${runId}`,
  { hours: 1 },
  api.sessions.cleanup,
);

export default crons;
