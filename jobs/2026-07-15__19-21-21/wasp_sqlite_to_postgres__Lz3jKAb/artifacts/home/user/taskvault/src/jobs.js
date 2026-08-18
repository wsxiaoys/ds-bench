export const logStartupEvent = async (args, context) => {
  await context.entities.EventLog.create({
    data: { message: 'Server started' },
  })
}
