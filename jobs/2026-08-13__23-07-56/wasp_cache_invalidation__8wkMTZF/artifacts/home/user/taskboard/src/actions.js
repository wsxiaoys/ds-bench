import { HttpError } from 'wasp/server'

export const addTask = async ({ projectId, title }, context) => {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new HttpError(400, 'Title is required')
  }
  return context.entities.Task.create({
    data: {
      title,
      projectId,
      done: false
    }
  })
}

export const toggleTask = async ({ id }, context) => {
  const task = await context.entities.Task.findUnique({
    where: { id }
  })
  if (!task) {
    throw new HttpError(404, `Task with id ${id} not found`)
  }
  return context.entities.Task.update({
    where: { id },
    data: {
      done: !task.done
    }
  })
}
