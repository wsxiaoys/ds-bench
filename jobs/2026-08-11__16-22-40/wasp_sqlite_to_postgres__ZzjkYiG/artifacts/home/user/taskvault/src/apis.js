export const getStats = async (req, res, context) => {
  const taskCount = await context.entities.Task.count()
  res.json({ taskCount })
}
