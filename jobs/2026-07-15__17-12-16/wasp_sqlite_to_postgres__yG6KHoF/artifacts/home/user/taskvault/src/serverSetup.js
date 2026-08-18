import { myStartupJob } from 'wasp/server/jobs'

export const setupServer = async () => {
  console.log("Server is starting up, submitting startup job...")
  try {
    await myStartupJob.submit()
    console.log("Startup job submitted successfully!")
  } catch (err) {
    console.error("Failed to submit startup job:", err)
  }
}
