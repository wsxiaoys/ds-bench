import { startupJob } from 'wasp/server/jobs'

export const serverSetup = async () => {
  console.log('Server is starting, submitting startup job...')
  await startupJob.submit()
}
