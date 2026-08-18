export async function recordStartupEvent(args, context) {
  console.log('Record startup event job running with args:', args)
  await context.entities.EventLog.create({
    data: {
      message: args && args.message ? args.message : 'Server started',
    },
  })
}
