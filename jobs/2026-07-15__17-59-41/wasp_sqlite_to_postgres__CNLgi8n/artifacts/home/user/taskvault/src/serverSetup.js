import { startupJob } from 'wasp/server/jobs'

export const setup = async () => {
  // Submit the startup job so it runs exactly once on every server start.
  await startupJob.submit({})
}