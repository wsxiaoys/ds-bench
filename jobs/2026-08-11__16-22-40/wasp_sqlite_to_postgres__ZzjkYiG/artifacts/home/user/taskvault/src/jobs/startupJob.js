export const runStartupJob = async (args, context) => {
  console.log('Running startup job with args:', args)
  await context.entities.EventLog.create({
    data: {
      message: args.message || 'Startup job executed',
    },
  })
}
