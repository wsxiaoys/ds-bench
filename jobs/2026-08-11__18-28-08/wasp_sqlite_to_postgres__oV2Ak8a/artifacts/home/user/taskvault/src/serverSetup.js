import { startupJob } from "wasp/server/jobs"

export const setup = async () => {
  console.log("Server setup: submitting startup job...")
  await startupJob.submit()
}
