export const runStartupJob = async (args, context) => {
  console.log("Startup job running...")
  await context.entities.EventLog.create({
    data: {
      message: "Startup job executed"
    }
  })
  console.log("Startup job completed successfully.")
}
