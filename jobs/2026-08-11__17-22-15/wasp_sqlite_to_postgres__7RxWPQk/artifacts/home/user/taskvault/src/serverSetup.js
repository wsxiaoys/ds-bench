import { startupJob } from "wasp/server/jobs"

export const serverSetup = async () => {
  console.log("Server setup: submitting startupJob...")
  await startupJob.submit()
}
