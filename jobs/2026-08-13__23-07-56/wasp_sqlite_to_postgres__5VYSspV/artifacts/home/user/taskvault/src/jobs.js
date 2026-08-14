export const runStartupJob = async (args, context) => {
  console.log('Running startup job inside worker...')
  await context.entities.EventLog.create({
    data: {
      message: 'Startup job executed'
    }
  })
}
