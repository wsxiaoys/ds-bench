// Creates a new task in the given project.
// Shares the Task entity with getTasks, so Wasp automatically refreshes
// getTasks after this Action runs.
export const addTask = async ({ projectId, title }, context) => {
  return context.entities.Task.create({
    data: {
      title,
      projectId,
    },
  })
}

// Flips a task's done state.
// Shares the Task entity with getTasks, so Wasp automatically refreshes
// getTasks after this Action runs.
export const toggleTask = async ({ taskId }, context) => {
  const task = await context.entities.Task.findUnique({
    where: { id: taskId },
  })
  if (!task) {
    throw new Error(`Task with id ${taskId} not found`)
  }
  return context.entities.Task.update({
    where: { id: taskId },
    data: { done: !task.done },
  })
}