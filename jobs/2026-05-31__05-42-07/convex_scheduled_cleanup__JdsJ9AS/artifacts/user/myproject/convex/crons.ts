import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  `cleanup-sessions-${process.env.ZEALT_RUN_ID}`,
  { minuteUTC: 0 },
  api.sessions.cleanup
);

export default crons;
