import { myStartupJob } from 'wasp/server/jobs'

export const setupFn = async (context) => {
  console.log("[serverSetup] Server is starting up, submitting myStartupJob...");
  await myStartupJob.submit({ message: "Startup job executed via serverSetup" });
  console.log("[serverSetup] myStartupJob submitted successfully.");
}
