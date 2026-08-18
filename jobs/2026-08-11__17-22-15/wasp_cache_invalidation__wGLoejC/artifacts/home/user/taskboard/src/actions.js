export const addTask = async (args, context) => {
  if (!args.title || args.title.trim() === '') {
    throw new Error('Title is required')
  }
  return context.entities.Task.create({
    data: {
      title: args.title,
      done: false,
      project: { connect: { id: Number(args.projectId) } }
    }
  })
}

export const toggleTask = async (args, context) => {
  const id = args.id !== undefined ? args.id : args.taskId
  const task = await context.entities.Task.findUnique({
    where: { id: Number(id) }
  })
  if (!task) {
    throw new Error('Task not found')
  }
  return context.entities.Task.update({
    where: { id: Number(id) },
    data: { done: !task.done }
  })
}
