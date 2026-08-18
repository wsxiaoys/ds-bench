import { HttpError } from 'wasp/server'

// Action: creates a new task in a given project.
export const addTask = async ({ projectId, title }, context) => {
  if (!projectId) {
    throw new HttpError(400, 'projectId is required')
  }
  if (!title || !title.trim()) {
    throw new HttpError(400, 'title is required')
  }

  return context.entities.Task.create({
    data: {
      title,
      done: false,
      project: { connect: { id: projectId } },
    },
  })
}

// Action: flips a task's done state.
export const toggleTask = async ({ taskId }, context) => {
  if (!taskId) {
    throw new HttpError(400, 'taskId is required')
  }

  const task = await context.entities.Task.findUnique({
    where: { id: taskId },
  })
  if (!task) {
    throw new HttpError(404, 'Task not found')
  }

  return context.entities.Task.update({
    where: { id: taskId },
    data: { done: !task.done },
  })
}
