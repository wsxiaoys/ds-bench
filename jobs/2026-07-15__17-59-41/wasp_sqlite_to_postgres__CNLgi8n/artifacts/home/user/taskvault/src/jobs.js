export const logStartup = async (_args, context) => {
  await context.entities.EventLog.create({
    data: { message: 'Server started' }
  })
}