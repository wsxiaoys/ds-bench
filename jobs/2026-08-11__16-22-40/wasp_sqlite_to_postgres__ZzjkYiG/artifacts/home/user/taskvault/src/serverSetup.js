import { startupJob } from 'wasp/server/jobs'

export const setup = async () => {
  console.log('Server setup: submitting startupJob...')
  try {
    await startupJob.submit({ message: 'Server started and job triggered' })
    console.log('Server setup: startupJob submitted successfully.')
  } catch (error) {
    console.error('Server setup: failed to submit startupJob:', error)
  }
}
