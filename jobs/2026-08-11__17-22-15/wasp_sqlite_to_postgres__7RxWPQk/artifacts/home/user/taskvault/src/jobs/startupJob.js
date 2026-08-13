export const runStartupJob = async (args, context) => {
  console.log("Running startup job...")
  await context.entities.EventLog.create({
    data: {
      message: "Startup job executed"
    }
  })
}
